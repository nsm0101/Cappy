#!/usr/bin/env python3
"""
Generate Cappy.xcodeproj (project.pbxproj) for the native Cappy iOS app.

This produces a two-target project (the Cappy app + the CappyWidget extension)
with entitlements, Info.plists, an asset catalog, an App Group, and the widget
embedded into the app. It is a convenience so the project opens without
installing XcodeGen; `project.yml` remains the canonical, regenerable spec.

Run from the ios-native/ directory:
    python3 project/generate_xcodeproj.py
"""

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------------------
# Deterministic 24-hex object IDs.
# ---------------------------------------------------------------------------
_counter = 0
_ids = {}

def oid(key):
    """Stable 24-hex id for a semantic key."""
    global _counter
    if key not in _ids:
        _counter += 1
        _ids[key] = f"CA9900{_counter:018X}"[:24].upper().ljust(24, "0")
    return _ids[key]

def collect_swift(rel_dir):
    """All .swift files under rel_dir (relative to ROOT), as repo-relative paths."""
    base = os.path.join(ROOT, rel_dir)
    out = []
    for dirpath, _dirs, files in os.walk(base):
        for f in sorted(files):
            if f.endswith(".swift"):
                full = os.path.join(dirpath, f)
                out.append(os.path.relpath(full, ROOT))
    return sorted(out)

app_sources = collect_swift("Cappy") + collect_swift("Shared")
widget_sources = collect_swift("CappyWidget") + collect_swift("Shared")

# Unique file references (path -> id). Shared files appear in both targets but
# have a single file reference.
all_paths = sorted(set(app_sources + widget_sources))
assets_path = "Cappy/Resources/Assets.xcassets"

def fileref_id(path):
    return oid("fref:" + path)

def buildfile_id(path, target):
    return oid(f"bf:{target}:{path}")

lines = []
def w(s=""):
    lines.append(s)

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
w("// !$*UTF8*$!")
w("{")
w("\tarchiveVersion = 1;")
w("\tclasses = {")
w("\t};")
w("\tobjectVersion = 56;")
w("\tobjects = {")

# ---------------------------------------------------------------------------
# PBXBuildFile
# ---------------------------------------------------------------------------
w("\n/* Begin PBXBuildFile section */")
for p in app_sources:
    w(f"\t\t{buildfile_id(p,'app')} /* {os.path.basename(p)} in Sources */ = {{isa = PBXBuildFile; fileRef = {fileref_id(p)} /* {os.path.basename(p)} */; }};")
for p in widget_sources:
    w(f"\t\t{buildfile_id(p,'widget')} /* {os.path.basename(p)} in Sources */ = {{isa = PBXBuildFile; fileRef = {fileref_id(p)} /* {os.path.basename(p)} */; }};")
# Assets in app resources
w(f"\t\t{oid('bf:assets')} /* Assets.xcassets in Resources */ = {{isa = PBXBuildFile; fileRef = {oid('fref:assets')} /* Assets.xcassets */; }};")
# Privacy manifest in app resources
w(f"\t\t{oid('bf:privacy')} /* PrivacyInfo.xcprivacy in Resources */ = {{isa = PBXBuildFile; fileRef = {oid('fref:privacy')} /* PrivacyInfo.xcprivacy */; }};")
# Embed widget
w(f"\t\t{oid('bf:embedwidget')} /* CappyWidget.appex in Embed Foundation Extensions */ = {{isa = PBXBuildFile; fileRef = {oid('prod:widget')} /* CappyWidget.appex */; settings = {{ATTRIBUTES = (RemoveHeadersOnCopy, ); }}; }};")
w("/* End PBXBuildFile section */")

# ---------------------------------------------------------------------------
# PBXCopyFilesBuildPhase (embed extension)
# ---------------------------------------------------------------------------
w("\n/* Begin PBXCopyFilesBuildPhase section */")
w(f"\t\t{oid('phase:embed')} /* Embed Foundation Extensions */ = {{")
w("\t\t\tisa = PBXCopyFilesBuildPhase;")
w("\t\t\tbuildActionMask = 2147483647;")
w("\t\t\tdstPath = \"\";")
w("\t\t\tdstSubfolderSpec = 13;")
w("\t\t\tfiles = (")
w(f"\t\t\t\t{oid('bf:embedwidget')} /* CappyWidget.appex in Embed Foundation Extensions */,")
w("\t\t\t);")
w("\t\t\tname = \"Embed Foundation Extensions\";")
w("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
w("\t\t};")
w("/* End PBXCopyFilesBuildPhase section */")

# ---------------------------------------------------------------------------
# PBXFileReference
# ---------------------------------------------------------------------------
w("\n/* Begin PBXFileReference section */")
# File references use the full SRCROOT-relative path so Xcode locates each file
# regardless of the (purely organizational, name-only) group hierarchy.
for p in all_paths:
    name = os.path.basename(p)
    w(f"\t\t{fileref_id(p)} /* {name} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = \"{name}\"; path = \"{p}\"; sourceTree = SOURCE_ROOT; }};")
# Assets
w(f"\t\t{oid('fref:assets')} /* Assets.xcassets */ = {{isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; name = Assets.xcassets; path = \"Cappy/Resources/Assets.xcassets\"; sourceTree = SOURCE_ROOT; }};")
w(f"\t\t{oid('fref:privacy')} /* PrivacyInfo.xcprivacy */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.xml; name = PrivacyInfo.xcprivacy; path = \"Cappy/Resources/PrivacyInfo.xcprivacy\"; sourceTree = SOURCE_ROOT; }};")
# Info.plists + entitlements
w(f"\t\t{oid('fref:appinfo')} /* Info.plist */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.xml; name = Info.plist; path = \"Cappy/Resources/Info.plist\"; sourceTree = SOURCE_ROOT; }};")
w(f"\t\t{oid('fref:appent')} /* Cappy.entitlements */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; name = Cappy.entitlements; path = \"Cappy/Resources/Cappy.entitlements\"; sourceTree = SOURCE_ROOT; }};")
w(f"\t\t{oid('fref:winfo')} /* Info.plist */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.xml; name = Info.plist; path = \"CappyWidget/Info.plist\"; sourceTree = SOURCE_ROOT; }};")
w(f"\t\t{oid('fref:went')} /* CappyWidget.entitlements */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; name = CappyWidget.entitlements; path = \"CappyWidget/CappyWidget.entitlements\"; sourceTree = SOURCE_ROOT; }};")
# Products
w(f"\t\t{oid('prod:app')} /* Cappy.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = Cappy.app; sourceTree = BUILT_PRODUCTS_DIR; }};")
w(f"\t\t{oid('prod:widget')} /* CappyWidget.appex */ = {{isa = PBXFileReference; explicitFileType = \"wrapper.app-extension\"; includeInIndex = 0; path = CappyWidget.appex; sourceTree = BUILT_PRODUCTS_DIR; }};")
w("/* End PBXFileReference section */")

# ---------------------------------------------------------------------------
# PBXFrameworksBuildPhase (system frameworks autolink via Swift imports)
# ---------------------------------------------------------------------------
w("\n/* Begin PBXFrameworksBuildPhase section */")
for t in ("app", "widget"):
    w(f"\t\t{oid('phase:frameworks:'+t)} /* Frameworks */ = {{")
    w("\t\t\tisa = PBXFrameworksBuildPhase;")
    w("\t\t\tbuildActionMask = 2147483647;")
    w("\t\t\tfiles = (")
    w("\t\t\t);")
    w("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    w("\t\t};")
w("/* End PBXFrameworksBuildPhase section */")

# ---------------------------------------------------------------------------
# PBXGroup
# ---------------------------------------------------------------------------
# Flat groups: Cappy, Shared, CappyWidget, Products. Simpler and correct;
# Xcode shows files by path.
def group(gid, name, children, path=None):
    w(f"\t\t{gid} /* {name} */ = {{")
    w("\t\t\tisa = PBXGroup;")
    w("\t\t\tchildren = (")
    for c in children:
        w(f"\t\t\t\t{c},")
    w("\t\t\t);")
    if path:
        w(f"\t\t\tpath = {path};")
    else:
        w(f"\t\t\tname = {name};")
    w("\t\t\tsourceTree = \"<group>\";")
    w("\t\t};")

w("\n/* Begin PBXGroup section */")
# main group
group(oid('grp:main'), "MainGroup", [
    oid('grp:cappy'), oid('grp:shared'), oid('grp:widget'), oid('grp:products')
])
# Cappy group: all app-only swift + assets + info + entitlements
cappy_children = [fileref_id(p) for p in app_sources if p.startswith("Cappy/")]
cappy_children += [oid('fref:assets'), oid('fref:privacy'), oid('fref:appinfo'), oid('fref:appent')]
group(oid('grp:cappy'), "Cappy", cappy_children)
# Shared group
shared_children = [fileref_id(p) for p in all_paths if p.startswith("Shared/")]
group(oid('grp:shared'), "Shared", shared_children)
# Widget group
widget_children = [fileref_id(p) for p in widget_sources if p.startswith("CappyWidget/")]
widget_children += [oid('fref:winfo'), oid('fref:went')]
group(oid('grp:widget'), "CappyWidget", widget_children)
# Products
group(oid('grp:products'), "Products", [oid('prod:app'), oid('prod:widget')])
w("/* End PBXGroup section */")

# ---------------------------------------------------------------------------
# PBXNativeTarget
# ---------------------------------------------------------------------------
w("\n/* Begin PBXNativeTarget section */")
# App
w(f"\t\t{oid('target:app')} /* Cappy */ = {{")
w("\t\t\tisa = PBXNativeTarget;")
w(f"\t\t\tbuildConfigurationList = {oid('cfglist:app')} /* Build configuration list for PBXNativeTarget \"Cappy\" */;")
w("\t\t\tbuildPhases = (")
w(f"\t\t\t\t{oid('phase:sources:app')} /* Sources */,")
w(f"\t\t\t\t{oid('phase:frameworks:app')} /* Frameworks */,")
w(f"\t\t\t\t{oid('phase:resources:app')} /* Resources */,")
w(f"\t\t\t\t{oid('phase:embed')} /* Embed Foundation Extensions */,")
w("\t\t\t);")
w("\t\t\tbuildRules = (")
w("\t\t\t);")
w("\t\t\tdependencies = (")
w(f"\t\t\t\t{oid('dep:widget')} /* PBXTargetDependency */,")
w("\t\t\t);")
w("\t\t\tname = Cappy;")
w("\t\t\tproductName = Cappy;")
w(f"\t\t\tproductReference = {oid('prod:app')} /* Cappy.app */;")
w("\t\t\tproductType = \"com.apple.product-type.application\";")
w("\t\t};")
# Widget
w(f"\t\t{oid('target:widget')} /* CappyWidgetExtension */ = {{")
w("\t\t\tisa = PBXNativeTarget;")
w(f"\t\t\tbuildConfigurationList = {oid('cfglist:widget')} /* Build configuration list for PBXNativeTarget \"CappyWidgetExtension\" */;")
w("\t\t\tbuildPhases = (")
w(f"\t\t\t\t{oid('phase:sources:widget')} /* Sources */,")
w(f"\t\t\t\t{oid('phase:frameworks:widget')} /* Frameworks */,")
w("\t\t\t);")
w("\t\t\tbuildRules = (")
w("\t\t\t);")
w("\t\t\tdependencies = (")
w("\t\t\t);")
w("\t\t\tname = CappyWidgetExtension;")
w("\t\t\tproductName = CappyWidget;")
w(f"\t\t\tproductReference = {oid('prod:widget')} /* CappyWidget.appex */;")
w("\t\t\tproductType = \"com.apple.product-type.app-extension\";")
w("\t\t};")
w("/* End PBXNativeTarget section */")

# ---------------------------------------------------------------------------
# PBXProject
# ---------------------------------------------------------------------------
w("\n/* Begin PBXProject section */")
w(f"\t\t{oid('project')} /* Project object */ = {{")
w("\t\t\tisa = PBXProject;")
w("\t\t\tattributes = {")
w("\t\t\t\tBuildIndependentTargetsInParallel = 1;")
w("\t\t\t\tLastSwiftUpdateCheck = 1520;")
w("\t\t\t\tLastUpgradeCheck = 1520;")
w("\t\t\t\tTargetAttributes = {")
w(f"\t\t\t\t\t{oid('target:app')} = {{")
w("\t\t\t\t\t\tCreatedOnToolsVersion = 15.2;")
w("\t\t\t\t\t\tProvisioningStyle = Automatic;")
w("\t\t\t\t\t};")
w(f"\t\t\t\t\t{oid('target:widget')} = {{")
w("\t\t\t\t\t\tCreatedOnToolsVersion = 15.2;")
w("\t\t\t\t\t\tProvisioningStyle = Automatic;")
w("\t\t\t\t\t};")
w("\t\t\t\t};")
w("\t\t\t};")
w(f"\t\t\tbuildConfigurationList = {oid('cfglist:project')} /* Build configuration list for PBXProject \"Cappy\" */;")
w("\t\t\tcompatibilityVersion = \"Xcode 14.0\";")
w("\t\t\tdevelopmentRegion = en;")
w("\t\t\thasScannedForEncodings = 0;")
w("\t\t\tknownRegions = (")
w("\t\t\t\ten,")
w("\t\t\t\tBase,")
w("\t\t\t);")
w(f"\t\t\tmainGroup = {oid('grp:main')};")
w(f"\t\t\tproductRefGroup = {oid('grp:products')} /* Products */;")
w("\t\t\tprojectDirPath = \"\";")
w("\t\t\tprojectRoot = \"\";")
w("\t\t\ttargets = (")
w(f"\t\t\t\t{oid('target:app')} /* Cappy */,")
w(f"\t\t\t\t{oid('target:widget')} /* CappyWidgetExtension */,")
w("\t\t\t);")
w("\t\t};")
w("/* End PBXProject section */")

# ---------------------------------------------------------------------------
# PBXResourcesBuildPhase
# ---------------------------------------------------------------------------
w("\n/* Begin PBXResourcesBuildPhase section */")
w(f"\t\t{oid('phase:resources:app')} /* Resources */ = {{")
w("\t\t\tisa = PBXResourcesBuildPhase;")
w("\t\t\tbuildActionMask = 2147483647;")
w("\t\t\tfiles = (")
w(f"\t\t\t\t{oid('bf:assets')} /* Assets.xcassets in Resources */,")
w(f"\t\t\t\t{oid('bf:privacy')} /* PrivacyInfo.xcprivacy in Resources */,")
w("\t\t\t);")
w("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
w("\t\t};")
w("/* End PBXResourcesBuildPhase section */")

# ---------------------------------------------------------------------------
# PBXSourcesBuildPhase
# ---------------------------------------------------------------------------
w("\n/* Begin PBXSourcesBuildPhase section */")
w(f"\t\t{oid('phase:sources:app')} /* Sources */ = {{")
w("\t\t\tisa = PBXSourcesBuildPhase;")
w("\t\t\tbuildActionMask = 2147483647;")
w("\t\t\tfiles = (")
for p in app_sources:
    w(f"\t\t\t\t{buildfile_id(p,'app')} /* {os.path.basename(p)} in Sources */,")
w("\t\t\t);")
w("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
w("\t\t};")
w(f"\t\t{oid('phase:sources:widget')} /* Sources */ = {{")
w("\t\t\tisa = PBXSourcesBuildPhase;")
w("\t\t\tbuildActionMask = 2147483647;")
w("\t\t\tfiles = (")
for p in widget_sources:
    w(f"\t\t\t\t{buildfile_id(p,'widget')} /* {os.path.basename(p)} in Sources */,")
w("\t\t\t);")
w("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
w("\t\t};")
w("/* End PBXSourcesBuildPhase section */")

# ---------------------------------------------------------------------------
# PBXTargetDependency
# ---------------------------------------------------------------------------
w("\n/* Begin PBXTargetDependency section */")
w(f"\t\t{oid('dep:widget')} /* PBXTargetDependency */ = {{")
w("\t\t\tisa = PBXTargetDependency;")
w(f"\t\t\ttarget = {oid('target:widget')} /* CappyWidgetExtension */;")
w(f"\t\t\ttargetProxy = {oid('proxy:widget')} /* PBXContainerItemProxy */;")
w("\t\t};")
w("/* End PBXTargetDependency section */")

w("\n/* Begin PBXContainerItemProxy section */")
w(f"\t\t{oid('proxy:widget')} /* PBXContainerItemProxy */ = {{")
w("\t\t\tisa = PBXContainerItemProxy;")
w(f"\t\t\tcontainerPortal = {oid('project')} /* Project object */;")
w("\t\t\tproxyType = 1;")
w(f"\t\t\tremoteGlobalIDString = {oid('target:widget')};")
w("\t\t\tremoteInfo = CappyWidgetExtension;")
w("\t\t};")
w("/* End PBXContainerItemProxy section */")

# ---------------------------------------------------------------------------
# XCBuildConfiguration
# ---------------------------------------------------------------------------
def settings_block(d, indent="\t\t\t\t"):
    out = []
    for k in sorted(d.keys()):
        v = d[k]
        if isinstance(v, list):
            out.append(f"{indent}{k} = (")
            for item in v:
                out.append(f"{indent}\t{item},")
            out.append(f"{indent});")
        else:
            out.append(f"{indent}{k} = {v};")
    return "\n".join(out)

project_common = {
    "ALWAYS_SEARCH_USER_PATHS": "NO",
    "ASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS": "YES",
    "CLANG_ANALYZER_NONNULL": "YES",
    "CLANG_ENABLE_MODULES": "YES",
    "CLANG_ENABLE_OBJC_ARC": "YES",
    "CLANG_ENABLE_OBJC_WEAK": "YES",
    "COPY_PHASE_STRIP": "NO",
    "ENABLE_STRICT_OBJC_MSGSEND": "YES",
    "GCC_C_LANGUAGE_STANDARD": "gnu17",
    "GCC_NO_COMMON_BLOCKS": "YES",
    "IPHONEOS_DEPLOYMENT_TARGET": "17.0",
    "MTL_FAST_MATH": "YES",
    "SDKROOT": "iphoneos",
    "SWIFT_EMIT_LOC_STRINGS": "YES",
}
project_debug = dict(project_common, **{
    "DEBUG_INFORMATION_FORMAT": "dwarf",
    "ENABLE_TESTABILITY": "YES",
    "GCC_DYNAMIC_NO_PIC": "NO",
    "GCC_OPTIMIZATION_LEVEL": "0",
    "GCC_PREPROCESSOR_DEFINITIONS": ["\"DEBUG=1\"", "\"$(inherited)\""],
    "MTL_ENABLE_DEBUG_INFO": "INCLUDE_SOURCE",
    "ONLY_ACTIVE_ARCH": "YES",
    "SWIFT_ACTIVE_COMPILATION_CONDITIONS": ["DEBUG", "\"$(inherited)\""],
    "SWIFT_OPTIMIZATION_LEVEL": "\"-Onone\"",
})
project_release = dict(project_common, **{
    "DEBUG_INFORMATION_FORMAT": "\"dwarf-with-dsym\"",
    "ENABLE_NS_ASSERTIONS": "NO",
    "MTL_ENABLE_DEBUG_INFO": "NO",
    "SWIFT_COMPILATION_MODE": "wholemodule",
    "VALIDATE_PRODUCT": "YES",
})

app_common = {
    "ASSETCATALOG_COMPILER_APPICON_NAME": "AppIcon",
    "ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME": "AccentColor",
    "CODE_SIGN_ENTITLEMENTS": "Cappy/Resources/Cappy.entitlements",
    "CODE_SIGN_STYLE": "Automatic",
    "CURRENT_PROJECT_VERSION": "1",
    "ENABLE_PREVIEWS": "YES",
    "GENERATE_INFOPLIST_FILE": "NO",
    "INFOPLIST_FILE": "Cappy/Resources/Info.plist",
    "LD_RUNPATH_SEARCH_PATHS": ["\"$(inherited)\"", "\"@executable_path/Frameworks\""],
    "MARKETING_VERSION": "0.1.0",
    "PRODUCT_BUNDLE_IDENTIFIER": "com.closedose.cappy",
    "PRODUCT_NAME": "\"$(TARGET_NAME)\"",
    "SWIFT_EMIT_LOC_STRINGS": "YES",
    "SWIFT_VERSION": "5.0",
    "TARGETED_DEVICE_FAMILY": "1",
}
widget_common = {
    "CODE_SIGN_ENTITLEMENTS": "CappyWidget/CappyWidget.entitlements",
    "CODE_SIGN_STYLE": "Automatic",
    "CURRENT_PROJECT_VERSION": "1",
    "GENERATE_INFOPLIST_FILE": "NO",
    "INFOPLIST_FILE": "CappyWidget/Info.plist",
    "INFOPLIST_KEY_CFBundleDisplayName": "Cappy",
    "INFOPLIST_KEY_NSHumanReadableCopyright": "\"\"",
    "LD_RUNPATH_SEARCH_PATHS": ["\"$(inherited)\"", "\"@executable_path/Frameworks\"", "\"@executable_path/../../Frameworks\""],
    "MARKETING_VERSION": "0.1.0",
    "PRODUCT_BUNDLE_IDENTIFIER": "com.closedose.cappy.CappyWidget",
    "PRODUCT_NAME": "\"$(TARGET_NAME)\"",
    "SKIP_INSTALL": "YES",
    "SWIFT_EMIT_LOC_STRINGS": "YES",
    "SWIFT_VERSION": "5.0",
    "TARGETED_DEVICE_FAMILY": "1",
}

def build_config(cid, name, settings):
    w(f"\t\t{cid} /* {name} */ = {{")
    w("\t\t\tisa = XCBuildConfiguration;")
    w("\t\t\tbuildSettings = {")
    w(settings_block(settings))
    w("\t\t\t};")
    w(f"\t\t\tname = {name};")
    w("\t\t};")

w("\n/* Begin XCBuildConfiguration section */")
build_config(oid('cfg:project:debug'), "Debug", project_debug)
build_config(oid('cfg:project:release'), "Release", project_release)
build_config(oid('cfg:app:debug'), "Debug", app_common)
build_config(oid('cfg:app:release'), "Release", app_common)
build_config(oid('cfg:widget:debug'), "Debug", widget_common)
build_config(oid('cfg:widget:release'), "Release", widget_common)
w("/* End XCBuildConfiguration section */")

# ---------------------------------------------------------------------------
# XCConfigurationList
# ---------------------------------------------------------------------------
def config_list(lid, name, debug_id, release_id):
    w(f"\t\t{lid} /* Build configuration list for {name} */ = {{")
    w("\t\t\tisa = XCConfigurationList;")
    w("\t\t\tbuildConfigurations = (")
    w(f"\t\t\t\t{debug_id} /* Debug */,")
    w(f"\t\t\t\t{release_id} /* Release */,")
    w("\t\t\t);")
    w("\t\t\tdefaultConfigurationIsVisible = 0;")
    w("\t\t\tdefaultConfigurationName = Release;")
    w("\t\t};")

w("\n/* Begin XCConfigurationList section */")
config_list(oid('cfglist:project'), "PBXProject \"Cappy\"", oid('cfg:project:debug'), oid('cfg:project:release'))
config_list(oid('cfglist:app'), "PBXNativeTarget \"Cappy\"", oid('cfg:app:debug'), oid('cfg:app:release'))
config_list(oid('cfglist:widget'), "PBXNativeTarget \"CappyWidgetExtension\"", oid('cfg:widget:debug'), oid('cfg:widget:release'))
w("/* End XCConfigurationList section */")

# ---------------------------------------------------------------------------
# Footer
# ---------------------------------------------------------------------------
w("\t};")
w(f"\trootObject = {oid('project')} /* Project object */;")
w("}")

# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------
proj_dir = os.path.join(ROOT, "Cappy.xcodeproj")
os.makedirs(proj_dir, exist_ok=True)
out_path = os.path.join(proj_dir, "project.pbxproj")
with open(out_path, "w") as fh:
    fh.write("\n".join(lines) + "\n")

# Note: the embed build file id must match the one referenced by the phase.
print(f"Wrote {out_path}")
print(f"App sources: {len(app_sources)}  Widget sources: {len(widget_sources)}  Unique files: {len(all_paths)}")
