package com.worldmenu.pay

import android.Manifest
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.stripe.stripeterminal.Terminal
import com.stripe.stripeterminal.external.callable.*
import com.stripe.stripeterminal.external.models.*
import com.stripe.stripeterminal.log.LogLevel
import com.worldmenu.pay.databinding.ActivityMainBinding
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.*
import org.json.JSONObject

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private lateinit var prefs: SharedPreferences
    private var serverApi: ServerApi? = null
    private var webSocket: WebSocket? = null
    private var isTerminalInitialized = false

    companion object {
        private const val LOCATION_PERMISSION_CODE = 1001
        private const val PREFS_NAME = "worldmenu_pay"
        private const val KEY_SERVER_URL = "server_url"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)

        // Restore saved server URL
        val savedUrl = prefs.getString(KEY_SERVER_URL, "") ?: ""
        if (savedUrl.isNotEmpty()) {
            binding.serverUrlInput.setText(savedUrl)
        }

        binding.connectButton.setOnClickListener { connect() }

        // Request location permission (required by Stripe Terminal)
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION),
                LOCATION_PERMISSION_CODE
            )
        }
    }

    private fun connect() {
        val rawUrl = binding.serverUrlInput.text.toString().trim()
        if (rawUrl.isEmpty()) {
            Toast.makeText(this, "Enter server URL", Toast.LENGTH_SHORT).show()
            return
        }

        val baseUrl = if (rawUrl.startsWith("http")) rawUrl else "http://$rawUrl"
        prefs.edit().putString(KEY_SERVER_URL, rawUrl).apply()

        binding.connectButton.isEnabled = false
        binding.connectButton.text = "Connecting..."

        serverApi = ServerApi(baseUrl)

        lifecycleScope.launch {
            try {
                // Test server connection
                val reachable = serverApi!!.ping()
                if (!reachable) {
                    showError("Cannot reach server at $baseUrl")
                    return@launch
                }

                // Initialize Stripe Terminal
                if (!isTerminalInitialized) {
                    initStripeTerminal(baseUrl)
                }

                // Switch to payment view
                binding.setupSection.visibility = View.GONE
                binding.paymentSection.visibility = View.VISIBLE
                setStatus("Connected", true)

                // Connect WebSocket to listen for payment requests
                connectWebSocket(baseUrl)

            } catch (e: Exception) {
                showError("Connection failed: ${e.message}")
            }
        }
    }

    private fun initStripeTerminal(baseUrl: String) {
        if (isTerminalInitialized) return

        Terminal.initTerminal(
            this,
            LogLevel.VERBOSE,
            object : ConnectionTokenProvider {
                override fun fetchConnectionToken(callback: ConnectionTokenCallback) {
                    lifecycleScope.launch {
                        try {
                            val token = serverApi!!.getConnectionToken()
                            callback.onSuccess(token)
                        } catch (e: Exception) {
                            callback.onFailure(ConnectionTokenException("Failed: ${e.message}"))
                        }
                    }
                }
            },
            object : TerminalListener {
                override fun onUnexpectedReaderDisconnect(reader: Reader) {
                    runOnUiThread {
                        setStatus("Reader disconnected", false)
                        binding.tapPrompt.text = "Reader disconnected. Reconnecting..."
                    }
                }
            }
        )
        isTerminalInitialized = true

        // Discover and connect to built-in (tap-to-pay) reader
        discoverReader()
    }

    private fun discoverReader() {
        binding.tapPrompt.text = "Setting up tap-to-pay..."
        binding.progressBar.visibility = View.VISIBLE

        val config = DiscoveryConfiguration.TapToPayDiscoveryConfiguration(
            isSimulated = false // Set to true for testing without NFC
        )

        Terminal.getInstance().discoverReaders(
            config,
            { readers ->
                // Auto-connect to first available built-in reader
            },
            object : Callback {
                override fun onSuccess() {
                    runOnUiThread {
                        binding.progressBar.visibility = View.GONE
                        binding.tapPrompt.text = "Waiting for payment request..."
                        setStatus("Ready", true)
                    }
                }

                override fun onFailure(e: TerminalException) {
                    runOnUiThread {
                        binding.progressBar.visibility = View.GONE
                        binding.tapPrompt.text = "Tap-to-pay setup failed: ${e.errorMessage}\n\nMake sure NFC is enabled."
                        setStatus("Error", false)
                    }
                }
            }
        )
    }

    private fun connectWebSocket(baseUrl: String) {
        val wsUrl = baseUrl.replace("http://", "ws://").replace("https://", "wss://")
        val client = OkHttpClient()
        val request = Request.Builder()
            .url("$wsUrl/ws?role=terminal")
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val msg = JSONObject(text)
                    when (msg.optString("type")) {
                        "PAYMENT_REQUEST" -> {
                            val amount = msg.getInt("amount")
                            val table = msg.optString("table", "")
                            val orderId = msg.optInt("orderId", 0)
                            runOnUiThread { startPayment(amount, table, orderId) }
                        }
                        "PAYMENT_CANCEL" -> {
                            Terminal.getInstance().cancelPaymentIntent(object : PaymentIntentCallback {
                                override fun onSuccess(intent: PaymentIntent) {
                                    runOnUiThread { resetToIdle() }
                                }
                                override fun onFailure(e: TerminalException) {
                                    runOnUiThread { resetToIdle() }
                                }
                            })
                        }
                    }
                } catch (e: Exception) {
                    // Ignore non-JSON messages
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                runOnUiThread {
                    setStatus("Disconnected", false)
                    // Auto-reconnect after 3 seconds
                    lifecycleScope.launch {
                        delay(3000)
                        connectWebSocket(baseUrl)
                    }
                }
            }

            override fun onOpen(webSocket: WebSocket, response: Response) {
                // Register as terminal
                webSocket.send(JSONObject().apply {
                    put("type", "TERMINAL_CONNECTED")
                    put("deviceName", android.os.Build.MODEL)
                }.toString())
                runOnUiThread { setStatus("Connected", true) }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                runOnUiThread { setStatus("Disconnected", false) }
            }
        })
    }

    private fun startPayment(amountCents: Int, tableNumber: String, orderId: Int) {
        val dollars = amountCents / 100.0
        binding.amountLabel.text = if (tableNumber.isNotEmpty()) "Table $tableNumber" else "Payment"
        binding.amountText.text = "$${String.format("%.2f", dollars)}"
        binding.tapPrompt.text = "Tap, insert, or swipe card"
        binding.resultIcon.visibility = View.GONE
        binding.progressBar.visibility = View.GONE

        lifecycleScope.launch {
            try {
                // Create payment intent on server
                val intentInfo = serverApi!!.createPaymentIntent(amountCents, tableNumber)

                // Retrieve the payment intent in the SDK
                Terminal.getInstance().retrievePaymentIntent(
                    intentInfo.clientSecret,
                    object : PaymentIntentCallback {
                        override fun onSuccess(paymentIntent: PaymentIntent) {
                            // Collect payment method (tap/insert/swipe)
                            collectPayment(paymentIntent, tableNumber, amountCents)
                        }

                        override fun onFailure(e: TerminalException) {
                            runOnUiThread { showPaymentError(e.errorMessage ?: "Failed to start payment") }
                        }
                    }
                )
            } catch (e: Exception) {
                showPaymentError(e.message ?: "Payment error")
            }
        }
    }

    private fun collectPayment(paymentIntent: PaymentIntent, tableNumber: String, amountCents: Int) {
        runOnUiThread {
            binding.tapPrompt.text = "Tap, insert, or swipe card"
        }

        val config = CollectConfiguration.Builder().build()

        Terminal.getInstance().collectPaymentMethod(
            paymentIntent,
            object : PaymentIntentCallback {
                override fun onSuccess(collectedIntent: PaymentIntent) {
                    // Card collected — now confirm
                    runOnUiThread {
                        binding.tapPrompt.text = "Processing..."
                        binding.progressBar.visibility = View.VISIBLE
                    }

                    Terminal.getInstance().confirmPaymentIntent(
                        collectedIntent,
                        object : PaymentIntentCallback {
                            override fun onSuccess(confirmedIntent: PaymentIntent) {
                                runOnUiThread {
                                    showPaymentSuccess()
                                }
                                // Notify server
                                lifecycleScope.launch {
                                    try {
                                        serverApi!!.notifyPaymentSuccess(
                                            confirmedIntent.id,
                                            tableNumber,
                                            amountCents
                                        )
                                        // Send success via WebSocket too
                                        webSocket?.send(JSONObject().apply {
                                            put("type", "PAYMENT_SUCCESS")
                                            put("paymentIntentId", confirmedIntent.id)
                                            put("amount", amountCents)
                                            put("table", tableNumber)
                                        }.toString())
                                    } catch (e: Exception) {
                                        // Server notification is best-effort
                                    }
                                    delay(3000)
                                    runOnUiThread { resetToIdle() }
                                }
                            }

                            override fun onFailure(e: TerminalException) {
                                runOnUiThread {
                                    showPaymentError(e.errorMessage ?: "Payment declined")
                                }
                                webSocket?.send(JSONObject().apply {
                                    put("type", "PAYMENT_FAILED")
                                    put("error", e.errorMessage ?: "Declined")
                                    put("table", tableNumber)
                                }.toString())
                            }
                        }
                    )
                }

                override fun onFailure(e: TerminalException) {
                    runOnUiThread {
                        showPaymentError(e.errorMessage ?: "Card read failed")
                    }
                }
            },
            config
        )
    }

    private fun showPaymentSuccess() {
        binding.progressBar.visibility = View.GONE
        binding.tapPrompt.text = "Approved!"
        binding.tapPrompt.setTextColor(ContextCompat.getColor(this, android.R.color.white))
        binding.resultIcon.text = "✅"
        binding.resultIcon.visibility = View.VISIBLE
    }

    private fun showPaymentError(message: String) {
        binding.progressBar.visibility = View.GONE
        binding.tapPrompt.text = message
        binding.tapPrompt.setTextColor(0xFFef4444.toInt())
        binding.resultIcon.text = "❌"
        binding.resultIcon.visibility = View.VISIBLE

        lifecycleScope.launch {
            delay(4000)
            runOnUiThread { resetToIdle() }
        }
    }

    private fun resetToIdle() {
        binding.amountLabel.text = "Ready"
        binding.amountText.text = ""
        binding.tapPrompt.text = "Waiting for payment request..."
        binding.tapPrompt.setTextColor(0xFF64748b.toInt())
        binding.resultIcon.visibility = View.GONE
        binding.progressBar.visibility = View.GONE
    }

    private fun setStatus(text: String, connected: Boolean) {
        binding.statusText.text = text
        binding.statusDot.setBackgroundResource(
            if (connected) R.drawable.dot_green else R.drawable.dot_red
        )
    }

    private fun showError(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        binding.connectButton.isEnabled = true
        binding.connectButton.text = "Connect"
    }

    override fun onDestroy() {
        super.onDestroy()
        webSocket?.close(1000, "App closed")
    }
}
