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
import com.stripe.stripeterminal.external.callable.Callback
import com.stripe.stripeterminal.external.callable.Cancelable
import com.stripe.stripeterminal.external.callable.ConnectionTokenCallback
import com.stripe.stripeterminal.external.callable.ConnectionTokenProvider
import com.stripe.stripeterminal.external.callable.DiscoveryListener
import com.stripe.stripeterminal.external.callable.PaymentIntentCallback
import com.stripe.stripeterminal.external.callable.ReaderCallback
import com.stripe.stripeterminal.external.callable.TapToPayReaderListener
import com.stripe.stripeterminal.external.callable.TerminalListener
import com.stripe.stripeterminal.external.models.ConnectionConfiguration
import com.stripe.stripeterminal.external.models.ConnectionTokenException
import com.stripe.stripeterminal.external.models.DiscoveryConfiguration
import com.stripe.stripeterminal.external.models.PaymentIntent
import com.stripe.stripeterminal.external.models.Reader
import com.stripe.stripeterminal.external.models.TerminalException
import com.stripe.stripeterminal.log.LogLevel
import com.worldmenu.pay.databinding.ActivityMainBinding
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private lateinit var prefs: SharedPreferences
    private var serverApi: ServerApi? = null
    private var webSocket: WebSocket? = null
    private var isTerminalInitialized = false
    private var currentCancelable: Cancelable? = null

    companion object {
        private const val LOCATION_PERMISSION_CODE = 1001
        private const val PREFS_NAME = "worldmenu_pay"
        private const val KEY_SERVER_URL = "server_url"
        private const val LOCATION_ID = "tml_GdYEMgnUdfYIoT"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val savedUrl = prefs.getString(KEY_SERVER_URL, "") ?: ""
        if (savedUrl.isNotEmpty()) binding.serverUrlInput.setText(savedUrl)

        binding.connectButton.setOnClickListener { connect() }

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
                if (!serverApi!!.ping()) { showError("Cannot reach server at $baseUrl"); return@launch }
                if (!isTerminalInitialized) initStripeTerminal()
                binding.setupSection.visibility = View.GONE
                binding.paymentSection.visibility = View.VISIBLE
                setStatus("Connected", true)
                connectWebSocket(baseUrl)
            } catch (e: Exception) {
                showError("Connection failed: ${e.message}")
            }
        }
    }

    private fun initStripeTerminal() {
        if (isTerminalInitialized) return
        Terminal.initTerminal(this, LogLevel.VERBOSE,
            object : ConnectionTokenProvider {
                override fun fetchConnectionToken(callback: ConnectionTokenCallback) {
                    lifecycleScope.launch {
                        try {
                            callback.onSuccess(serverApi!!.getConnectionToken())
                        } catch (e: Exception) {
                            callback.onFailure(ConnectionTokenException("Failed: ${e.message}"))
                        }
                    }
                }
            },
            object : TerminalListener {}
        )
        isTerminalInitialized = true
        discoverReader()
    }

    private fun discoverReader() {
        binding.tapPrompt.text = "Setting up tap-to-pay..."
        binding.progressBar.visibility = View.VISIBLE

        val config = DiscoveryConfiguration.TapToPayDiscoveryConfiguration(isSimulated = true)

        Terminal.getInstance().discoverReaders(config,
            object : DiscoveryListener {
                override fun onUpdateDiscoveredReaders(readers: List<Reader>) {
                    if (readers.isNotEmpty()) {
                        connectReader(readers[0])
                    }
                }
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
                        binding.tapPrompt.text = "Setup failed: ${e.errorMessage}\nMake sure NFC is enabled."
                        setStatus("Error", false)
                    }
                }
            }
        )
    }

    private fun connectReader(reader: Reader) {
        val connConfig = ConnectionConfiguration.TapToPayConnectionConfiguration(
            LOCATION_ID, false, object : TapToPayReaderListener {}
        )
        Terminal.getInstance().connectReader(reader, connConfig,
            object : ReaderCallback {
                override fun onSuccess(reader: Reader) {
                    runOnUiThread {
                        binding.progressBar.visibility = View.GONE
                        binding.tapPrompt.text = "Waiting for payment request..."
                        setStatus("Ready", true)
                    }
                }
                override fun onFailure(e: TerminalException) {
                    runOnUiThread {
                        binding.progressBar.visibility = View.GONE
                        binding.tapPrompt.text = "Reader connect failed: ${e.errorMessage}"
                        setStatus("Error", false)
                    }
                }
            }
        )
    }

    private fun connectWebSocket(baseUrl: String) {
        val wsUrl = baseUrl.replace("http://", "ws://").replace("https://", "wss://")
        val client = OkHttpClient()
        val request = Request.Builder().url("$wsUrl/ws?role=terminal").build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val msg = JSONObject(text)
                    when (msg.optString("type")) {
                        "PAYMENT_REQUEST" -> {
                            val amount = msg.getInt("amount")
                            val table = msg.optString("table", "")
                            runOnUiThread { startPayment(amount, table) }
                        }
                        "PAYMENT_CANCEL" -> {
                            currentCancelable?.cancel(object : Callback {
                                override fun onSuccess() { runOnUiThread { resetToIdle() } }
                                override fun onFailure(e: TerminalException) { runOnUiThread { resetToIdle() } }
                            })
                        }
                    }
                } catch (_: Exception) {}
            }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                runOnUiThread {
                    setStatus("Disconnected", false)
                    lifecycleScope.launch { delay(3000); connectWebSocket(baseUrl) }
                }
            }
            override fun onOpen(webSocket: WebSocket, response: Response) {
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

    private fun startPayment(amountCents: Int, tableNumber: String) {
        val dollars = amountCents / 100.0
        binding.amountLabel.text = if (tableNumber.isNotEmpty()) "Table $tableNumber" else "Payment"
        binding.amountText.text = "$${String.format("%.2f", dollars)}"
        binding.tapPrompt.text = "Tap, insert, or swipe card"
        binding.resultIcon.visibility = View.GONE
        binding.progressBar.visibility = View.GONE

        lifecycleScope.launch {
            try {
                val intentInfo = serverApi!!.createPaymentIntent(amountCents, tableNumber)
                Terminal.getInstance().retrievePaymentIntent(intentInfo.clientSecret,
                    object : PaymentIntentCallback {
                        override fun onSuccess(paymentIntent: PaymentIntent) {
                            collectPayment(paymentIntent, tableNumber, amountCents)
                        }
                        override fun onFailure(e: TerminalException) {
                            runOnUiThread { showPaymentError(e.errorMessage ?: "Failed to start") }
                        }
                    }
                )
            } catch (e: Exception) {
                showPaymentError(e.message ?: "Payment error")
            }
        }
    }

    private fun collectPayment(paymentIntent: PaymentIntent, tableNumber: String, amountCents: Int) {
        runOnUiThread { binding.tapPrompt.text = "Tap, insert, or swipe card" }

        currentCancelable = Terminal.getInstance().collectPaymentMethod(paymentIntent,
            object : PaymentIntentCallback {
                override fun onSuccess(collectedIntent: PaymentIntent) {
                    runOnUiThread {
                        binding.tapPrompt.text = "Processing..."
                        binding.progressBar.visibility = View.VISIBLE
                    }
                    Terminal.getInstance().confirmPaymentIntent(collectedIntent,
                        object : PaymentIntentCallback {
                            override fun onSuccess(confirmedIntent: PaymentIntent) {
                                runOnUiThread { showPaymentSuccess() }
                                lifecycleScope.launch {
                                    try {
                                        serverApi!!.notifyPaymentSuccess(
                                            confirmedIntent.id ?: "",
                                            tableNumber,
                                            amountCents
                                        )
                                        webSocket?.send(JSONObject().apply {
                                            put("type", "PAYMENT_SUCCESS")
                                            put("paymentIntentId", confirmedIntent.id ?: "")
                                            put("amount", amountCents)
                                            put("table", tableNumber)
                                        }.toString())
                                    } catch (_: Exception) {}
                                    delay(3000)
                                    runOnUiThread { resetToIdle() }
                                }
                            }
                            override fun onFailure(e: TerminalException) {
                                runOnUiThread { showPaymentError(e.errorMessage ?: "Declined") }
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
                    runOnUiThread { showPaymentError(e.errorMessage ?: "Card read failed") }
                }
            }
        )
    }

    private fun showPaymentSuccess() {
        binding.progressBar.visibility = View.GONE
        binding.tapPrompt.text = "Approved!"
        binding.tapPrompt.setTextColor(0xFF22c55e.toInt())
        binding.resultIcon.text = "\u2705"
        binding.resultIcon.visibility = View.VISIBLE
    }

    private fun showPaymentError(message: String) {
        binding.progressBar.visibility = View.GONE
        binding.tapPrompt.text = message
        binding.tapPrompt.setTextColor(0xFFef4444.toInt())
        binding.resultIcon.text = "\u274C"
        binding.resultIcon.visibility = View.VISIBLE
        lifecycleScope.launch { delay(4000); runOnUiThread { resetToIdle() } }
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
        binding.statusDot.setBackgroundResource(if (connected) R.drawable.dot_green else R.drawable.dot_red)
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
