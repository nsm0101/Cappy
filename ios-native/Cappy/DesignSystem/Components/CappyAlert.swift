//
//  CappyAlert.swift
//  Cappy
//
//  Lightweight Identifiable alert model + view modifier so screens can show
//  a one-off alert (or a two-button confirmation, e.g. "Log anyway") by
//  assigning to a single @State property.
//

import SwiftUI

struct CappyAlertAction {
    let label: String
    var role: ButtonRole? = nil
    var action: () -> Void = {}
}

struct CappyAlert: Identifiable {
    let id = UUID()
    let title: String
    var message: String? = nil
    /// Primary (confirming) action. When nil, the alert is informational (OK).
    var primary: CappyAlertAction? = nil
    /// Cancel label when a primary action is present.
    var cancelLabel: String = "Cancel"
}

extension View {
    func cappyAlert(_ item: Binding<CappyAlert?>) -> some View {
        alert(item.wrappedValue?.title ?? "",
              isPresented: Binding(get: { item.wrappedValue != nil },
                                   set: { if !$0 { item.wrappedValue = nil } }),
              presenting: item.wrappedValue) { current in
            if let primary = current.primary {
                Button(primary.label, role: primary.role) { primary.action() }
                Button(current.cancelLabel, role: .cancel) {}
            } else {
                Button("OK", role: .cancel) {}
            }
        } message: { current in
            if let message = current.message { Text(message) }
        }
    }
}
