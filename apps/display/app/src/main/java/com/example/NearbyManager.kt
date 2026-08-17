package com.example

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.content.ContextCompat
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.AdvertisingOptions
import com.google.android.gms.nearby.connection.ConnectionInfo
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback
import com.google.android.gms.nearby.connection.ConnectionResolution
import com.google.android.gms.nearby.connection.ConnectionsClient
import com.google.android.gms.nearby.connection.ConnectionsStatusCodes
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo
import com.google.android.gms.nearby.connection.DiscoveryOptions
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback
import com.google.android.gms.nearby.connection.Payload
import com.google.android.gms.nearby.connection.PayloadCallback
import com.google.android.gms.nearby.connection.PayloadTransferUpdate
import com.google.android.gms.nearby.connection.Strategy
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.util.concurrent.CopyOnWriteArrayList

class NearbyManager(
  private val context: Context,
  private var webView: WebView?
) {
  companion object {
    private const val TAG = "NearbyManager"
    private const val SERVICE_ID = "hic_rhodus_p2p"
    private val STRATEGY = Strategy.P2P_STAR
  }

  private val mainHandler = Handler(Looper.getMainLooper())
  private val connectedEndpoints = CopyOnWriteArrayList<String>()
  private var currentRole: String = "none"

  private val connectionsClient: ConnectionsClient? by lazy {
    try {
      Nearby.getConnectionsClient(context.applicationContext)
    } catch (e: Throwable) {
      Log.e(TAG, "Failed to initialize Nearby ConnectionsClient", e)
      null
    }
  }

  fun setWebView(view: WebView?) {
    this.webView = view
  }

  private fun evaluateJs(script: String) {
    mainHandler.post {
      try {
        webView?.evaluateJavascript(script, null)
      } catch (e: Exception) {
        Log.e(TAG, "Failed to evaluate JS: $script", e)
      }
    }
  }

  private fun notifyStatus(status: String, details: String = "") {
    Log.d(TAG, "Status changed: $status ($details)")
    val safeDetails = JSONObject.quote(details)
    evaluateJs("window.onNearbyStatusChanged && window.onNearbyStatusChanged('$status', $safeDetails);")
  }

  private fun notifyPayload(jsonPayload: String) {
    val safeJson = JSONObject.quote(jsonPayload)
    evaluateJs("window.onNearbyPayloadReceived && window.onNearbyPayloadReceived($safeJson);")
  }

  private val payloadCallback = object : PayloadCallback() {
    override fun onPayloadReceived(endpointId: String, payload: Payload) {
      if (payload.type == Payload.Type.BYTES) {
        val bytes = payload.asBytes() ?: return
        val message = String(bytes, StandardCharsets.UTF_8)
        Log.d(TAG, "Received payload from $endpointId: $message")
        notifyPayload(message)
      }
    }

    override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {}
  }

  private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {
    override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
      Log.d(TAG, "Connection initiated with: ${info.endpointName} ($endpointId)")
      notifyStatus("connecting", info.endpointName)
      try {
        connectionsClient?.acceptConnection(endpointId, payloadCallback)
          ?.addOnFailureListener { e ->
            Log.e(TAG, "Accept connection failed", e)
            notifyStatus("error", "Verbindung fehlgeschlagen: ${e.message}")
          }
      } catch (e: Exception) {
        Log.e(TAG, "Error accepting connection", e)
      }
    }

    override fun onConnectionResult(endpointId: String, resolution: ConnectionResolution) {
      when (resolution.status.statusCode) {
        ConnectionsStatusCodes.STATUS_OK -> {
          Log.d(TAG, "Connected successfully to: $endpointId")
          if (!connectedEndpoints.contains(endpointId)) {
            connectedEndpoints.add(endpointId)
          }
          notifyStatus("connected", "Verbunden ($endpointId)")
        }
        ConnectionsStatusCodes.STATUS_CONNECTION_REJECTED -> {
          Log.w(TAG, "Connection rejected by: $endpointId")
          notifyStatus("rejected", endpointId)
        }
        else -> {
          Log.e(TAG, "Connection error with: $endpointId status: ${resolution.status.statusCode}")
          notifyStatus("error", "Verbindungsstatus: ${resolution.status.statusMessage ?: resolution.status.statusCode}")
        }
      }
    }

    override fun onDisconnected(endpointId: String) {
      Log.d(TAG, "Disconnected from: $endpointId")
      connectedEndpoints.remove(endpointId)
      if (connectedEndpoints.isEmpty()) {
        notifyStatus("disconnected", "Verbindung getrennt")
      } else {
        notifyStatus("connected", "Verbunden: ${connectedEndpoints.size} Geräte")
      }
    }
  }

  private val endpointDiscoveryCallback = object : EndpointDiscoveryCallback() {
    override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
      Log.d(TAG, "Endpoint found: ${info.endpointName} ($endpointId)")
      notifyStatus("found_device", info.endpointName)
      
      try {
        connectionsClient?.requestConnection(
          "Controller",
          endpointId,
          connectionLifecycleCallback
        )?.addOnSuccessListener {
          Log.d(TAG, "Requested connection to: $endpointId")
        }?.addOnFailureListener { e ->
          Log.e(TAG, "Request connection failed", e)
          notifyStatus("error", "Verbindung anfordern fehlgeschlagen: ${e.message}")
        }
      } catch (e: Exception) {
        Log.e(TAG, "Error requesting connection", e)
      }
    }

    override fun onEndpointLost(endpointId: String) {
      Log.d(TAG, "Endpoint lost: $endpointId")
    }
  }

  fun hasRequiredPermissions(): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val scan = ContextCompat.checkSelfPermission(context, android.Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED
      val adv = ContextCompat.checkSelfPermission(context, android.Manifest.permission.BLUETOOTH_ADVERTISE) == PackageManager.PERMISSION_GRANTED
      val conn = ContextCompat.checkSelfPermission(context, android.Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
      return scan && adv && conn
    } else {
      return ContextCompat.checkSelfPermission(context, android.Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    }
  }

  // --- JavaScript Interface methods ---

  @JavascriptInterface
  fun isNearbySupported(): Boolean {
    return connectionsClient != null
  }

  @JavascriptInterface
  fun checkPermissions(): Boolean {
    return hasRequiredPermissions()
  }

  @JavascriptInterface
  fun requestPermissions() {
    mainHandler.post {
      if (context is MainActivity) {
        context.requestRequiredNearbyPermissions()
      }
    }
  }

  @JavascriptInterface
  fun startDisplayMode(name: String) {
    currentRole = "display"
    stopAllInternal()

    val client = connectionsClient
    if (client == null) {
      notifyStatus("error", "Nearby Service nicht verfügbar")
      return
    }

    val endpointName = if (name.isNotBlank()) name else "HicRhodusDisplay"
    val advertisingOptions = AdvertisingOptions.Builder().setStrategy(STRATEGY).build()

    try {
      client.startAdvertising(
        endpointName,
        SERVICE_ID,
        connectionLifecycleCallback,
        advertisingOptions
      ).addOnSuccessListener {
        Log.d(TAG, "Advertising started as Display ($endpointName)")
        notifyStatus("advertising", endpointName)
      }.addOnFailureListener { e ->
        Log.e(TAG, "Advertising start failed", e)
        notifyStatus("error", "Display bereitstellen fehlgeschlagen: ${e.message}")
      }
    } catch (e: SecurityException) {
      Log.e(TAG, "Missing permissions for startAdvertising", e)
      notifyStatus("error", "Berechtigungen für Bluetooth/Standort fehlen")
      requestPermissions()
    } catch (e: Exception) {
      Log.e(TAG, "Exception in startAdvertising", e)
      notifyStatus("error", "Fehler beim Starten von Display")
    }
  }

  @JavascriptInterface
  fun startControllerMode() {
    currentRole = "controller"
    stopAllInternal()

    val client = connectionsClient
    if (client == null) {
      notifyStatus("error", "Nearby Service nicht verfügbar")
      return
    }

    val discoveryOptions = DiscoveryOptions.Builder().setStrategy(STRATEGY).build()

    try {
      client.startDiscovery(
        SERVICE_ID,
        endpointDiscoveryCallback,
        discoveryOptions
      ).addOnSuccessListener {
        Log.d(TAG, "Discovery started as Controller")
        notifyStatus("discovering", "Suche nach Display Gerät...")
      }.addOnFailureListener { e ->
        Log.e(TAG, "Discovery start failed", e)
        notifyStatus("error", "Suche fehlgeschlagen: ${e.message}")
      }
    } catch (e: SecurityException) {
      Log.e(TAG, "Missing permissions for startDiscovery", e)
      notifyStatus("error", "Berechtigungen für Bluetooth/Standort fehlen")
      requestPermissions()
    } catch (e: Exception) {
      Log.e(TAG, "Exception in startDiscovery", e)
      notifyStatus("error", "Fehler beim Suchen")
    }
  }

  @JavascriptInterface
  fun sendPayload(jsonString: String) {
    val client = connectionsClient
    if (client == null || connectedEndpoints.isEmpty()) {
      return
    }

    try {
      val payload = Payload.fromBytes(jsonString.toByteArray(StandardCharsets.UTF_8))
      for (endpoint in connectedEndpoints) {
        client.sendPayload(endpoint, payload).addOnFailureListener { e ->
          Log.e(TAG, "Failed to send payload to $endpoint", e)
        }
      }
    } catch (e: Exception) {
      Log.e(TAG, "Failed to send payload", e)
    }
  }

  @JavascriptInterface
  fun stopNearby() {
    stopAllInternal()
    notifyStatus("idle", "Gestoppt")
  }

  private fun stopAllInternal() {
    try {
      connectionsClient?.stopAdvertising()
      connectionsClient?.stopDiscovery()
      connectionsClient?.stopAllEndpoints()
      connectedEndpoints.clear()
    } catch (e: Exception) {
      Log.e(TAG, "Error stopping Nearby", e)
    }
  }
}
