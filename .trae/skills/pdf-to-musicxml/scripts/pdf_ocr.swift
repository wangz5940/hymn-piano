import AppKit
import Foundation
import PDFKit
import Vision

struct Configuration {
    let inputURL: URL
    let outputURL: URL
    let scale: CGFloat
}

enum OCRError: Error, LocalizedError {
    case invalidArguments
    case cannotOpenPDF(URL)
    case cannotCreateImage(Int)
    case cannotWriteOutput(URL)

    var errorDescription: String? {
        switch self {
        case .invalidArguments:
            return "Usage: swift pdf_ocr.swift <input.pdf> <output.txt> [scale]"
        case .cannotOpenPDF(let url):
            return "Cannot open PDF: \(url.path)"
        case .cannotCreateImage(let page):
            return "Cannot render page \(page)."
        case .cannotWriteOutput(let url):
            return "Cannot write output: \(url.path)"
        }
    }
}

func parseConfiguration() throws -> Configuration {
    let arguments = CommandLine.arguments.dropFirst()
    guard arguments.count == 2 || arguments.count == 3 else {
        throw OCRError.invalidArguments
    }

    let inputURL = URL(fileURLWithPath: String(arguments[arguments.startIndex]))
    let outputURL = URL(fileURLWithPath: String(arguments[arguments.index(after: arguments.startIndex)]))
    let scaleArgumentIndex = arguments.index(arguments.startIndex, offsetBy: 2)
    let scale = arguments.count == 3 ? CGFloat(Double(arguments[scaleArgumentIndex]) ?? 3.0) : 3.0

    return Configuration(inputURL: inputURL, outputURL: outputURL, scale: max(scale, 1.0))
}

func renderPage(_ page: PDFPage, scale: CGFloat) -> CGImage? {
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

func recognizeText(in image: CGImage) throws -> [String] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["zh-Hans", "en-US"]
    request.minimumTextHeight = 0.006
    request.customWords = [
        "哈农", "拜厄", "练指法", "钢琴", "乐谱", "小节", "指法",
        "legato", "staccato", "allegro", "andante", "moderato"
    ]

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    try handler.perform([request])

    let observations = request.results ?? []
    return observations
        .sorted {
            let verticalDifference = abs($0.boundingBox.midY - $1.boundingBox.midY)
            if verticalDifference < 0.012 {
                return $0.boundingBox.minX < $1.boundingBox.minX
            }
            return $0.boundingBox.midY > $1.boundingBox.midY
        }
        .compactMap { $0.topCandidates(1).first?.string }
}

func run() throws {
    let configuration = try parseConfiguration()
    guard let document = PDFDocument(url: configuration.inputURL) else {
        throw OCRError.cannotOpenPDF(configuration.inputURL)
    }

    let fileName = configuration.inputURL.deletingPathExtension().lastPathComponent
    var output = [
        "# \(fileName) OCR 文本",
        "",
        "说明：本文件由 macOS Vision OCR 从扫描 PDF 生成。五线谱音符请以同名 MusicXML 产物为准。",
        "识别语言：简体中文、英文。",
        "页数：\(document.pageCount)",
        ""
    ]

    for index in 0..<document.pageCount {
        let pageNumber = index + 1
        guard let page = document.page(at: index), let image = renderPage(page, scale: configuration.scale) else {
            throw OCRError.cannotCreateImage(pageNumber)
        }

        let lines = try recognizeText(in: image)
        output.append("## PDF 第 \(pageNumber) 页")
        output.append(lines.isEmpty ? "[未识别到可提取文字；本页可能主要是乐谱或图像。]" : lines.joined(separator: "\n"))
        output.append("")
        fputs("OCR \(pageNumber)/\(document.pageCount)\n", stderr)
    }

    let text = output.joined(separator: "\n")
    guard let data = text.data(using: .utf8) else {
        throw OCRError.cannotWriteOutput(configuration.outputURL)
    }

    try FileManager.default.createDirectory(
        at: configuration.outputURL.deletingLastPathComponent(),
        withIntermediateDirectories: true
    )
    try data.write(to: configuration.outputURL, options: .atomic)
}

do {
    try run()
} catch {
    fputs("Error: \(error.localizedDescription)\n", stderr)
    exit(1)
}
