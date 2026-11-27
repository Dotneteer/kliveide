// Prints the window number of the largest on-screen window owned by the process id given as the argument
// (dev/scripts/sam-parity/oracle.cjs grabs that window with `screencapture -l`).
import CoreGraphics
import Foundation
let pid = Int(CommandLine.arguments[1]) ?? -1
let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]
var best: (Int, Double) = (-1, 0)
for w in list where (w[kCGWindowOwnerPID as String] as? Int) == pid {
  let b = w[kCGWindowBounds as String] as! [String: Any]
  let area = ((b["Width"] as? Double) ?? 0) * ((b["Height"] as? Double) ?? 0)
  if area > best.1 { best = ((w[kCGWindowNumber as String] as? Int) ?? -1, area) }
}
print(best.0)
