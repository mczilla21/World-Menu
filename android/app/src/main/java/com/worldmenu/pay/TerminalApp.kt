package com.worldmenu.pay

import android.app.Application

class TerminalApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // Stripe Terminal SDK is initialized in MainActivity after we have the server URL
    }
}
