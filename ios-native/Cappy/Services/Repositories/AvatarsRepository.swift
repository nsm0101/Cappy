//
//  AvatarsRepository.swift
//  Cappy
//
//  Avatar upload + signed-URL resolution against the private `avatars`
//  bucket. Paths are versioned so replacing a photo busts every cache layer.
//  Port of app/src/api/avatars.ts.
//

import Foundation

enum AvatarsRepository {
    private static var db: PostgREST { SupabaseClient.shared.db }
    private static var storage: StorageService { SupabaseClient.shared.storage }

    private struct AvatarPathRow: Decodable { let avatarUrl: String? }

    /// Upload a child's avatar (JPEG) and point the record at the new path.
    @discardableResult
    static func uploadChildAvatar(familyId: String, childId: String, jpeg: Data) async throws -> String {
        let existing = try? await db.from("children").select("avatar_url").eq("id", childId)
            .execute(decoding: [AvatarPathRow].self).first?.avatarUrl

        let path = "\(familyId)/\(childId)-\(Int(Date().timeIntervalSince1970 * 1000)).jpg"
        try await storage.uploadJPEG(jpeg, to: path)
        _ = try await db.from("children").update(["avatar_url": path]).eq("id", childId).run()
        await removeOld(existing ?? nil, newPath: path)
        return path
    }

    /// Upload the current caregiver's avatar (JPEG) to their profile.
    @discardableResult
    static func uploadMyAvatar(familyId: String, jpeg: Data) async throws -> String {
        guard let uid = SupabaseClient.shared.auth.currentUser?.id else {
            throw SupabaseError(status: 401, message: "Not signed in")
        }
        let existing = try? await db.from("profiles").select("avatar_url").eq("id", uid)
            .execute(decoding: [AvatarPathRow].self).first?.avatarUrl

        let path = "\(familyId)/caregiver-\(uid)-\(Int(Date().timeIntervalSince1970 * 1000)).jpg"
        try await storage.uploadJPEG(jpeg, to: path)
        _ = try await db.from("profiles").update(["avatar_url": path]).eq("id", uid).run()
        await removeOld(existing ?? nil, newPath: path)
        return path
    }

    /// Resolve a stored avatar path to a short-lived signed URL for display.
    static func signedURL(path: String?) async -> URL? {
        guard let path, !path.isEmpty else { return nil }
        return await storage.signedURL(path: path)
    }

    private static func removeOld(_ oldPath: String?, newPath: String) async {
        guard let oldPath, oldPath != newPath else { return }
        await storage.remove(paths: [oldPath])
    }
}
