import json
import os
import struct

def verify():
    print("=== Running CareerFunnel Extension Verification ===")
    
    # 1. Manifest verification
    with open("manifest.json", "r", encoding="utf-8") as f:
        manifest = json.load(f)
    print("[OK] manifest.json is valid JSON")
    assert manifest["manifest_version"] == 3, "Must be Manifest V3"
    assert "background" in manifest and "service_worker" in manifest["background"]
    assert "action" in manifest
    assert "side_panel" in manifest
    print("[OK] Manifest V3 core keys present")

    # 2. Verify all icons
    icons = manifest["icons"]
    for size_str, path in icons.items():
        size = int(size_str)
        assert os.path.exists(path), f"Icon {path} does not exist!"
        with open(path, "rb") as f:
            header = f.read(24)
            assert header[:8] == b'\x89PNG\r\n\x1a\n', f"Not a PNG: {path}"
            w, h = struct.unpack(">II", header[16:24])
            assert w == size and h == size, f"Icon {path} expected {size}x{size}, got {w}x{h}"
        print(f"[OK] Verified icon {path} ({size}x{size}px)")

    # 3. Verify all referenced files
    referenced_files = [
        manifest["background"]["service_worker"],
        manifest["action"]["default_popup"],
        manifest["side_panel"]["default_path"],
    ]
    for cs in manifest.get("content_scripts", []):
        referenced_files.extend(cs.get("js", []))
        referenced_files.extend(cs.get("css", []))

    for fpath in referenced_files:
        norm_path = fpath.replace("/", os.sep)
        assert os.path.exists(norm_path), f"Referenced file does not exist: {norm_path}"
        print(f"[OK] Verified referenced file: {norm_path}")

    # 4. Verify dashboard files exist
    dashboard_files = [
        "dashboard/dashboard.html",
        "dashboard/dashboard.css",
        "dashboard/dashboard.js",
        "shared/storage.js"
    ]
    for df in dashboard_files:
        norm_df = df.replace("/", os.sep)
        assert os.path.exists(norm_df), f"Dashboard file missing: {norm_df}"
        print(f"[OK] Verified dashboard file: {norm_df}")

    print("\nALL AUTOMATED VERIFICATION CHECKS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    verify()
