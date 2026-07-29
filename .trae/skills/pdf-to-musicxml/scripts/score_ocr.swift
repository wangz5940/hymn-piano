import AppKit
import Foundation
import PDFKit
import Vision

struct Configuration {
    let inputURL: URL
    let outputPrefix: URL
    let scale: CGFloat
}

struct BoundingBox: Encodable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct OCRObservation: Encodable {
    let text: String
    let confidence: Float
    let normalized_box: BoundingBox
    let pixel_box: BoundingBox
}

struct OCRPageRecord: Encodable {
    let schema_version: String
    let record_type: String
    let page: Int
    let source: String
    let image_width: Int
    let image_height: Int
    let text_lines: [String]
    let observations: [OCRObservation]
}

struct FingeringCandidateRecord: Encodable {
    let schema_version: String
    let record_type: String
    let page: Int
    let source: String
    let text: String
    let fingers: [Int]
    let confidence: Float
    let normalized_box: BoundingBox
    let pixel_box: BoundingBox
    let status: String
}

enum ScoreOCRError: Error, LocalizedError {
    case invalidArguments
    case cannotOpenInput(URL)
    case cannotCreateImage(Int)
    case cannotEncodeJSON
    case cannotWriteOutput(URL)

    var errorDescription: String? {
        switch self {
        case .invalidArguments:
            return "Usage: swift score_ocr.swift <input.pdf|png|jpg> <output-prefix> [scale]"
        case .cannotOpenInput(let url):
            return "Cannot open input: \(url.path)"
        case .cannotCreateImage(let page):
            return "Cannot render page \(page)."
        case .cannotEncodeJSON:
            return "Cannot encode JSON output."
        case .cannotWriteOutput(let url):
            return "Cannot write output: \(url.path)"
        }
    }
}

func parseConfiguration() throws -> Configuration {
    let arguments = CommandLine.arguments.dropFirst()
    guard arguments.count == 2 || arguments.count == 3 else {
        throw ScoreOCRError.invalidArguments
    }

    let inputURL = URL(fileURLWithPath: String(arguments[arguments.startIndex]))
    let outputPrefix = URL(fileURLWithPath: String(arguments[arguments.index(after: arguments.startIndex)]))
    let scaleArgumentIndex = arguments.index(arguments.startIndex, offsetBy: 2)
    let scale = arguments.count == 3 ? CGFloat(Double(arguments[scaleArgumentIndex]) ?? 4.0) : 4.0

    return Configuration(inputURL: inputURL, outputPrefix: outputPrefix, scale: max(scale, 1.0))
}

func renderPDFPage(_ page: PDFPage, scale: CGFloat) -> CGImage? {
    let bounds = page.bounds(for: .mediaBox)
    let width = max(Int((bounds.width * scale).rounded(.up)), 1)
    let height = max(Int((bounds.height * scale).rounded(.up)), 1)
    let colorSpace = CGColorSpaceCreateDeviceRGB()

    guard let context = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
        return nil
    }

    context.setFillColor(NSColor.white.cgColor)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: context)
    return context.makeImage()
}

func loadImage(_ url: URL) -> CGImage? {
    guard let image = NSImage(contentsOf: url) else {
        return nil
    }
    var rect = CGRect(origin: .zero, size: image.size)
    return image.cgImage(forProposedRect: &rect, context: nil, hints: nil)
}

func makeTextRequest() -> VNRecognizeTextRequest {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["zh-Hans", "en-US"]
    request.minimumTextHeight = 0.003
    request.customWords = [
        "指法", "手指", "手指操", "大拇指", "食指", "中指", "无名指", "小指",
        "右手", "左手", "拇指", "换指", "抬指", "五指",
        "legato", "staccato", "andante", "moderato",
        "1", "2", "3", "4", "5"
    ]
    return request
}

func recognizeText(in image: CGImage, source: String, page: Int) throws -> OCRPageRecord {
    let request = makeTextRequest()
    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    try handler.perform([request])

    let width = image.width
    let height = image.height
    let observations = (request.results ?? [])
        .compactMap { observation -> OCRObservation? in
            guard let candidate = observation.topCandidates(1).first else {
                return nil
            }
            let box = observation.boundingBox
            let normalized = BoundingBox(
                x: box.minX,
                y: box.minY,
                width: box.width,
                height: box.height
            )
            let pixel = BoundingBox(
                x: box.minX * Double(width),
                y: (1.0 - box.maxY) * Double(height),
                width: box.width * Double(width),
                height: box.height * Double(height)
            )
            return OCRObservation(
                text: candidate.string,
                confidence: candidate.confidence,
                normalized_box: normalized,
                pixel_box: pixel
            )
        }
        .sorted {
            let verticalDifference = abs($0.normalized_box.y - $1.normalized_box.y)
            if verticalDifference < 0.012 {
                return $0.normalized_box.x < $1.normalized_box.x
            }
            return $0.normalized_box.y > $1.normalized_box.y
        }

    return OCRPageRecord(
        schema_version: "1.0",
        record_type: "ocr_page",
        page: page,
        source: source,
        image_width: width,
        image_height: height,
        text_lines: observations.map(\.text),
        observations: observations
    )
}

func normalizeDigits(_ text: String) -> String {
    var result = ""
    for scalar in text.unicodeScalars {
        switch scalar.value {
        case 0xFF11...0xFF15:
            result.append(String(Int(scalar.value - 0xFF10)))
        default:
            result.unicodeScalars.append(scalar)
        }
    }
    return result
        .replacingOccurrences(of: "l", with: "1")
        .replacingOccurrences(of: "I", with: "1")
        .replacingOccurrences(of: "O", with: "0")
}

func fingeringDigits(from text: String) -> [Int] {
    let normalized = normalizeDigits(text)
    let allowedSeparators = CharacterSet(charactersIn: " \t\n\r-–—_.,，、()（）[]【】:")
    let compact = normalized.unicodeScalars
        .filter { !allowedSeparators.contains($0) }
        .map(String.init)
        .joined()

    guard !compact.isEmpty, compact.count <= 5 else {
        return []
    }
    guard compact.allSatisfy({ character in
        guard let value = Int(String(character)) else {
            return false
        }
        return value >= 1 && value <= 5
    }) else {
        return []
    }

    return compact.compactMap { Int(String($0)) }
}

func fingeringCandidates(from page: OCRPageRecord) -> [FingeringCandidateRecord] {
    page.observations.compactMap { observation in
        let fingers = fingeringDigits(from: observation.text)
        guard !fingers.isEmpty else {
            return nil
        }
        return FingeringCandidateRecord(
            schema_version: "1.0",
            record_type: "fingering_candidate",
            page: page.page,
            source: page.source,
            text: observation.text,
            fingers: fingers,
            confidence: observation.confidence,
            normalized_box: observation.normalized_box,
            pixel_box: observation.pixel_box,
            status: "candidate"
        )
    }
}

func jsonLine<T: Encodable>(_ value: T) throws -> String {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    let data = try encoder.encode(value)
    guard let text = String(data: data, encoding: .utf8) else {
        throw ScoreOCRError.cannotEncodeJSON
    }
    return text
}

func writeText(_ text: String, to url: URL) throws {
    guard let data = text.data(using: .utf8) else {
        throw ScoreOCRError.cannotWriteOutput(url)
    }
    try FileManager.default.createDirectory(
        at: url.deletingLastPathComponent(),
        withIntermediateDirectories: true
    )
    try data.write(to: url, options: .atomic)
}

func outputURL(prefix: URL, suffix: String) -> URL {
    let directory = prefix.deletingLastPathComponent()
    let name = prefix.lastPathComponent + suffix
    return directory.appendingPathComponent(name)
}

func run() throws {
    let configuration = try parseConfiguration()
    let sourceName = configuration.inputURL.lastPathComponent
    let fileExtension = configuration.inputURL.pathExtension.lowercased()
    var pageRecords: [OCRPageRecord] = []

    if fileExtension == "pdf" {
        guard let document = PDFDocument(url: configuration.inputURL) else {
            throw ScoreOCRError.cannotOpenInput(configuration.inputURL)
        }
        for index in 0..<document.pageCount {
            let pageNumber = index + 1
            guard let page = document.page(at: index),
                  let image = renderPDFPage(page, scale: configuration.scale) else {
                throw ScoreOCRError.cannotCreateImage(pageNumber)
            }
            let record = try recognizeText(in: image, source: sourceName, page: pageNumber)
            pageRecords.append(record)
            fputs("OCR \(pageNumber)/\(document.pageCount)\n", stderr)
        }
    } else {
        guard let image = loadImage(configuration.inputURL) else {
            throw ScoreOCRError.cannotOpenInput(configuration.inputURL)
        }
        pageRecords.append(try recognizeText(in: image, source: sourceName, page: 1))
        fputs("OCR 1/1\n", stderr)
    }

    let textURL = outputURL(prefix: configuration.outputPrefix, suffix: "_OCR文本.txt")
    let structuredURL = outputURL(prefix: configuration.outputPrefix, suffix: "_OCR结构.jsonl")
    let fingeringURL = outputURL(prefix: configuration.outputPrefix, suffix: "_指法候选.jsonl")

    var textOutput = [
        "# \(configuration.inputURL.deletingPathExtension().lastPathComponent) OCR 文本",
        "",
        "说明：本文件由 macOS Vision OCR 从扫描 PDF/图片生成。五线谱音符请以同名 MusicXML 产物为准。",
        "识别语言：简体中文、英文。",
        "页数：\(pageRecords.count)",
        ""
    ]
    var structuredLines: [String] = []
    var fingeringLines: [String] = []

    for page in pageRecords {
        textOutput.append("## PDF 第 \(page.page) 页")
        textOutput.append(page.text_lines.isEmpty ? "[未识别到可提取文字；本页可能主要是乐谱或图像。]" : page.text_lines.joined(separator: "\n"))
        textOutput.append("")
        structuredLines.append(try jsonLine(page))
        for candidate in fingeringCandidates(from: page) {
            fingeringLines.append(try jsonLine(candidate))
        }
    }

    try writeText(textOutput.joined(separator: "\n"), to: textURL)
    try writeText(structuredLines.joined(separator: "\n") + "\n", to: structuredURL)
    try writeText(fingeringLines.joined(separator: "\n") + "\n", to: fingeringURL)
}

do {
    try run()
} catch {
    fputs("Error: \(error.localizedDescription)\n", stderr)
    exit(1)
}
