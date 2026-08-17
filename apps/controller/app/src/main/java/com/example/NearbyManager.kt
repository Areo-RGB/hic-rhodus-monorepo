package com.example

import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.AdvertisingOptions
import com.google.android.gms.nearby.connection.ConnectionInfo
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback
import com.google.android.gms.nearby.connection.ConnectionResolution
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
  private var currentRole: String = "none" // "display", "controller", "none"
  private val connectionsClient by lazy {
    try {
      Nearby.getConnectionsClient(context)
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
      webView?.evaluateJavascript(script, null)
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

    override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {
      // Transfer update progress if needed
    }
  }

  private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {
    override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
      Log.d(TAG, "Connection initiated with: ${info.endpointName} ($endpointId)")
      notifyStatus("connecting", info.endpointName)
      // Auto accept connection
      connectionsClient.acceptConnection(endpointId, payloadCallback)
        .addOnFailureListener { e ->
          Log.e(TAG, "Accept connection failed", e)
          notifyStatus("error", "Accept failed: ${e.message}")
        }
    }

    override fun onConnectionResult(endpointId: String, resolution: ConnectionResolution) {
      when (resolution.status.statusCode) {
        ConnectionsStatusCodes.STATUS_OK -> {
          Log.d(TAG, "Connected successfully to: $endpointId")
          if (!connectedEndpoints.contains(endpointId)) {
            connectedEndpoints.add(endpointId)
          }
          notifyStatus("connected", "Connected devices: ${connectedEndpoints.size}")
        }
        ConnectionsStatusCodes.STATUS_CONNECTION_REJECTED -> {
          Log.w(TAG, "Connection rejected by: $endpointId")
          notifyStatus("rejected", endpointId)
        }
        ConnectionsStatusCodes.STATUS_ERROR -> {
          Log.e(TAG, "Connection error with: $endpointId")
          notifyStatus("error", "Connection error")
        }
      }
    }

    override fun onDisconnected(endpointId: String) {
      Log.d(TAG, "Disconnected from: $endpointId")
      connectedEndpoints.remove(endpointId)
      if (connectedEndpoints.isEmpty()) {
        notifyStatus("disconnected", "No devices connected")
      } else {
        notifyStatus("connected", "Connected devices: ${connectedEndpoints.size}")
      }
    }
  }

  private val endpointDiscoveryCallback = object : EndpointDiscoveryCallback() {
    override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
      Log.d(TAG, "Endpoint found: ${info.endpointName} ($endpointId)")
      notifyStatus("found_device", info.endpointName)
      
      // Auto request connection to Display
      connectionsClient?.requestConnection(
        "HicRhodusController",
        endpointId,
        connectionLifecycleCallback
      )?.addOnSuccessListener {
        Log.d(TAG, "Requested connection to: $endpointId")
      }?.addOnFailureListener { e ->
        Log.e(TAG, "Request connection failed", e)
        notifyStatus("error", "Connect failed: ${e.message}")
      }
    }

    override fun onEndpointLost(endpointId: String) {
      Log.d(TAG, "Endpoint lost: $endpointId")
    }
  }

  fun hasRequiredPermissions(): Boolean {
    val permissions = getRequiredPermissions()
    return permissions.all {
      ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
    }
  }

  fun getRequiredPermissions(): Array<String> {
    val list = mutableListOf<String>()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      list.add(android.Manifest.permission.BLUETOOTH_SCAN)
      list.add(android.Manifest.permission.BLUETOOTH_ADVERTISE)
      list.add(android.Manifest.permission.BLUETOOTH_CONNECT)
    } else {
      list.add(android.Manifest.permission.BLUETOOTH)
      list.add(android.Manifest.permission.BLUETOOTH_ADMIN)
      list.add(android.Manifest.permission.ACCESS_FINE_LOCATION)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      list.add(android.Manifest.permission.NEARBY_WIFI_DEVICES)
    }
    return list.toTypedArray()
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
      if (context is Activity && !hasRequiredPermissions()) {
        ActivityCompat.requestPermissions(context, getRequiredPermissions(), 1001)
      }
    }
  }

  @JavascriptInterface
  fun startDisplayMode(name: String) {
    currentRole = "display"
    stopAllInternal()

    val client = connectionsClient
    if (client == null) {
      notifyStatus("error", "Nearby is not available on this device")
      return
    }

    val endpointName = if (name.isNotBlank()) name else "HicRhodusDisplay"
    val advertisingOptions = AdvertisingOptions.Builder().setStrategy(STRATEGY).build()

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
      notifyStatus("error", "Advertising failed: ${e.message}")
    }
  }

  @JavascriptInterface
  fun startControllerMode() {
    currentRole = "controller"
    stopAllInternal()

    val client = connectionsClient
    if (client == null) {
      notifyStatus("error", "Nearby is not available on this device")
      return
    }

    val discoveryOptions = DiscoveryOptions.Builder().setStrategy(STRATEGY).build()

    client.startDiscovery(
      SERVICE_ID,
      endpointDiscoveryCallback,
      discoveryOptions
    ).addOnSuccessListener {
      Log.d(TAG, "Discovery started as Controller")
      notifyStatus("discovering", "Searching for Display...")
    }.addOnFailureListener { e ->
      Log.e(TAG, "Discovery start failed", e)
      notifyStatus("error", "Discovery failed: ${e.message}")
    }
  }

  @JavascriptInterface
  fun sendPayload(jsonString: String) {
    if (connectedEndpoints.isEmpty()) {
      Log.w(TAG, "Cannot send payload: No connected endpoints")
      return
    }

    val client = connectionsClient ?: return
    val payload = Payload.fromBytes(jsonString.toByteArray(StandardCharsets.UTF_8))
    for (endpoint in connectedEndpoints) {
      client.sendPayload(endpoint, payload).addOnFailureListener { e ->
        Log.e(TAG, "Failed to send payload to $endpoint", e)
      }
    }
  }

  @JavascriptInterface
  fun stopNearby() {
    stopAllInternal()
    notifyStatus("idle", "Stopped")
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
