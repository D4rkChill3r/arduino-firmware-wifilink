#include "CommLgc.h"
#include <ESP8266WiFi.h>
#include <ESP8266mDNS.h>
#include <WiFiUdp.h>
#include <ArduinoOTA.h>
#include "Configuration.h"

#include <FS.h>
#include <ArduinoJson.h>
#include <Hash.h>
#include <ESP8266WebServer.h>

int ledState = LOW;             // used to set the LED state
long previousMillis = 0;        // will store last time LED was updated
long ap_interval = 50;         //blink interval in ap mode
IPAddress default_IP(192,168,240,1);  //defaul IP Address
String HOSTNAME = DEF_HOSTNAME;
String staticIP_param ;
String netmask_param;
String gateway_param;
String dhcp = "on";

ESP8266WebServer server(80);    //server UI

void setup() {

  #if defined(MCU_OTA)
  _setup_dfu();
  #endif

  pinMode(WIFI_LED, OUTPUT);      //initialize wifi LED
  digitalWrite(WIFI_LED, LOW);
  ArduinoOTA.begin();             //OTA ESP
  initMDNS();
  CommunicationLogic.begin();
  SPIFFS.begin();
  initHostname();
  setWiFiConfig();
  initWebServer();                 //UI begin

}

void loop() {

  ArduinoOTA.handle();
  CommunicationLogic.handle();
  handleWebServer();
  wifiLed();

  #if defined(MCU_OTA)
  _handle_Mcu_OTA();
  #endif


}

void initMDNS(){

  MDNS.begin(HOSTNAME.c_str());
  MDNS.setInstanceName(HOSTNAME);
  MDNS.addServiceTxt("arduino", "tcp", "fw_name", FW_NAME);
  MDNS.addServiceTxt("arduino", "tcp", "fw_version", FW_VERSION);

}

void initHostname(){
  //retrieve user defined hostname
  String tmpHostname = Config.getParam("hostname");
  if( tmpHostname!="" )
    HOSTNAME = tmpHostname;
  WiFi.hostname(HOSTNAME);

}

void wifiLed(){

  unsigned long currentMillis = millis();
  int wifi_status = WiFi.status();
  if ((WiFi.getMode() == 1 || WiFi.getMode() == 3) && wifi_status == WL_CONNECTED) {    //wifi LED in STA MODE
    if (currentMillis - previousMillis > ap_interval) {
      previousMillis = currentMillis;
      if (ledState == LOW){
        ledState = HIGH;
        ap_interval = 200;    //time wifi led ON
      }
      else{
        ledState = LOW;
        ap_interval = 2800;   //time wifi led OFF
      }
      digitalWrite(WIFI_LED, ledState);
    }
  }
  else{ //if (WiFi.softAPgetStationNum() > 0 ) {   //wifi LED on in AP mode
    if (currentMillis - previousMillis > ap_interval) {
      previousMillis = currentMillis;
      if (ledState == LOW){
        ledState = HIGH;
        ap_interval = 950;
      }
      else{
        ledState = LOW;
        ap_interval = 50;
      }
      digitalWrite(WIFI_LED, ledState);
    }
  }

}

void setWiFiConfig(){

  //WiFi mode is remembered by the esp sdk
  if (WiFi.getMode() != WIFI_STA) {
  
    //set default AP
    String mac = WiFi.macAddress();
    String apSSID = String(SSIDNAME) + "-" + String(mac[9])+String(mac[10])+String(mac[12])+String(mac[13])+String(mac[15])+String(mac[16]);
    WiFi.softAP(apSSID.c_str());
    WiFi.softAPConfig(default_IP, default_IP, IPAddress(255, 255, 255, 0));   //set default ip for AP mode
  }
  //set STA mode
  #if defined(ESP_CH_SPI)
  ETS_SPI_INTR_DISABLE();
  #endif
  { // first static config if configured
    String staticIP = Config.getParam("staticIP").c_str();
    if (staticIP != "" && staticIP != "0.0.0.0") {
      dhcp = "off";
      staticIP_param = staticIP;
      netmask_param = Config.getParam("netMask").c_str();
      gateway_param = Config.getParam("gatewayIP").c_str();
      WiFi.config(stringToIP(staticIP_param), stringToIP(gateway_param), stringToIP(netmask_param));
    }
  }
  
  WiFi.begin(); // connect to AP with credentials remembered by esp sdk
  if (WiFi.waitForConnectResult() != WL_CONNECTED && WiFi.getMode() == WIFI_STA) { 
    // if STA didn't connect, start AP
    WiFi.mode(WIFI_AP_STA); // STA must be active for library connects
    setWiFiConfig(); // setup AP
  }
  #if defined(ESP_CH_SPI)
  ETS_SPI_INTR_ENABLE();
  #endif
}
