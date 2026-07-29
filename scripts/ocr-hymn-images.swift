import AppKit
import Foundation
import Vision

struct OCRBlock: Codable {
    let text: String
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct OCRPage: Codable {
    let filename: String
    let key_signature: String?
    let meter: String?
    let blocks: [OCRBlock]
}

func usage() -> Never {
    fputs("Usage: swift scripts/ocr-hymn-images.swift <image-dir> <output.jsonl> [limit]\n", stderr)
    exit(1)
}

let arguments = CommandLine.arguments.dropFirst()
guard arguments.count == 2 || arguments.count == 3 else {
    usage()
}

let imageDir = URL(fileURLWithPath: String(arguments[arguments.startIndex]))
let outputURL = URL(fileURLWithPath: String(arguments[arguments.index(after: arguments.startIndex)]))
let limit = arguments.count == 3 ? Int(arguments[arguments.index(arguments.startIndex, offsetBy: 2)]) : nil
let fm = FileManager.default
let encoder = JSONEncoder()
encoder.outputFormatting = [.withoutEscapingSlashes]

let filenames = try fm.contentsOfDirectory(atPath: imageDir.path)
    .filter { $0.lowercased().hasSuffix(".jpg") }
    .sorted { $0.localizedStandardCompare($1) == .orderedAscending }
let selectedFilenames = limit.map { Array(filenames.prefix($0)) } ?? filenames

try fm.createDirectory(
    at: outputURL.deletingLastPathComponent(),
    withIntermediateDirectories: true
)
fm.createFile(atPath: outputURL.path, contents: nil)
let handle = try FileHandle(forWritingTo: outputURL)
defer { try? handle.close() }

func cgImage(for url: URL) -> CGImage? {
    guard let image = NSImage(contentsOf: url) else { return nil }
    return image.cgImage(forProposedRect: nil, context: nil, hints: nil)
}

func detectKeySignature(from texts: [String]) -> String? {
    let joined = texts.joined(separator: " ")
    let patterns = [
        #"([升降]?[A-G][♯#b♭]?调)"#,
        #"([升降]?[A-G][♯#b♭]?\s*調)"#,
    ]
    for pattern in patterns {
        if let regex = try? NSRegularExpression(pattern: pattern) {
            let range = NSRange(joined.startIndex..<joined.endIndex, in: joined)
            if let match = regex.firstMatch(in: joined, range: range),
               let swiftRange = Range(match.range(at: 1), in: joined) {
                return String(joined[swiftRange]).replacingOccurrences(of: " ", with: "").replacingOccurrences(of: "調", with: "调")
            }
        }
    }
    return nil
}

func detectMeter(from texts: [String]) -> String? {
    let joined = texts.joined(separator: " ")
    if let regex = try? NSRegularExpression(pattern: #"([23468]/[248])"#) {
        let range = NSRange(joined.startIndex..<joined.endIndex, in: joined)
        if let match = regex.firstMatch(in: joined, range: range),
           let swiftRange = Range(match.range(at: 1), in: joined) {
            return String(joined[swiftRange])
        }
    }
    return nil
}

for (index, filename) in selectedFilenames.enumerated() {
    let url = imageDir.appendingPathComponent(filename)
    guard let image = cgImage(for: url) else {
        fputs("Skip unreadable image: \(filename)\n", stderr)
        continue
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    request.recognitionLanguages = ["zh-Hans", "en-US"]
    request.minimumTextHeight = 0.004
    request.customWords = ["降E调", "降B调", "升F调", "D大调", "指法", "和弦", "主音"]

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    try handler.perform([request])

    let blocks = (request.results ?? [])
        .compactMap { observation -> OCRBlock? in
            guard let text = observation.topCandidates(1).first?.string.trimmingCharacters(in: .whitespacesAndNewlines),
                  !text.isEmpty else {
                return nil
            }
            let box = observation.boundingBox
            return OCRBlock(
                text: text,
                x: Double(box.minX),
                y: Double(1 - box.maxY),
                width: Double(box.width),
                height: Double(box.height)
            )
        }
        .sorted {
            abs($0.y - $1.y) < 0.015 ? $0.x < $1.x : $0.y < $1.y
        }

    let texts = blocks.map(\.text)
    let page = OCRPage(
        filename: filename,
        key_signature: detectKeySignature(from: texts),
        meter: detectMeter(from: texts),
        blocks: blocks
    )
    let data = try encoder.encode(page)
    handle.write(data)
    handle.write(Data("\n".utf8))
    fputs("OCR \(index + 1)/\(selectedFilenames.count): \(filename)\n", stderr)
}
