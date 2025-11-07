/**
 * @brief This example demonstrates Zigbee multistate input / output device with custom states.
 *
 * The code represents a slightly altered version of the original code example for the Arduino Core for Espressif library.
 * The original code example was created by Jan Procházka (https://github.com/P-R-O-C-H-Y/)
 * Permalink to the original code example: https://github.com/espressif/arduino-esp32/tree/0ae08381ecc72aab3df07b0426fa0cb9f5b5132b/libraries/Zigbee/examples/Zigbee_Multistate_Input_Output
 *
 * Home Assistant ZHA does not support multistate input and output clusters yet.
 * But it is possible to integrate multistate input and output clusters into Home Assistant by using Zigbee2MQTT
 * and by using the external converter provided in this folder.
 *
 * Original code example created by Jan Procházka (https://github.com/P-R-O-C-H-Y/)
 * Altered by MikaFromTheRoof (https://github.com/MikaFromTheRoof/)
 */

#ifndef ZIGBEE_MODE_ZCZR
#error "Zigbee coordinator/router device mode is not selected in Tools->Zigbee mode"
#endif

#include "Zigbee.h"

/* Zigbee multistate device configuration */
#define MULTISTATE_DEVICE_ENDPOINT_NUMBER 1

uint8_t button = BOOT_PIN;

// zbMultistateDeviceCustom will use custom application states (user defined)
ZigbeeMultistate zbMultistateDeviceCustom = ZigbeeMultistate(MULTISTATE_DEVICE_ENDPOINT_NUMBER);

const char *multistate_custom_state_names[6] = {"Off", "On", "UltraSlow", "Slow", "Fast", "SuperFast"};

void onStateChangeCustom(uint16_t state) {
  // print the state
  Serial.printf("Received state change: %d\r\n", state);
  // print the state name using the stored state names
  if (state < zbMultistateDeviceCustom.getMultistateOutputStateNamesLength()) {
    Serial.printf("State name: %s\r\n", multistate_custom_state_names[state]);
  }
  // print state index of possible options
  Serial.printf("State index: %d / %d\r\n", state, zbMultistateDeviceCustom.getMultistateOutputStateNamesLength() - 1);

  Serial.print("Changing to fan mode to: ");
  switch (state) {
    case 0:  Serial.println("Off"); break;
    case 1:  Serial.println("On"); break;
    case 2:  Serial.println("UltraSlow"); break;
    case 3:  Serial.println("Slow"); break;
    case 4:  Serial.println("Fast"); break;
    case 5:  Serial.println("SuperFast"); break;
    default: Serial.println("Invalid state"); break;
  }
}

void setup() {
  log_d("Starting serial");
  Serial.begin(115200);

  // Init button switch
  log_d("Init button switch");
  pinMode(button, INPUT_PULLUP);

  // Optional: set Zigbee device name and model
  log_d("Set Zigbee device manufacturer and model");
  zbMultistateDeviceCustom.setManufacturerAndModel("MikaFromTheRoof", "ZigbeeMultistateDevice");

  // Set up custom output
  log_d("Add Multistate Output");
  zbMultistateDeviceCustom.addMultistateOutput();
  log_d("Set Multistate Output Application");
  zbMultistateDeviceCustom.setMultistateOutputApplication(ZB_MULTISTATE_APPLICATION_TYPE_OTHER_INDEX);
  log_d("Set Multistate Output Description");
  zbMultistateDeviceCustom.setMultistateOutputDescription("Fan (off/on/ultraslow/slow/fast/superfast)");
  zbMultistateDeviceCustom.setMultistateOutputStates(6);

  // Set callback function for multistate output change
  log_d("Set callback function for multistate output change");
  zbMultistateDeviceCustom.onMultistateOutputChange(onStateChangeCustom);

  // Add endpoints to Zigbee Core
  log_d("Add endpoints to Zigbee Core");
  Zigbee.addEndpoint(&zbMultistateDeviceCustom);

  Serial.println("Starting Zigbee...");
  // When all EPs are registered, start Zigbee in Router Device mode
  if (!Zigbee.begin(ZIGBEE_ROUTER)) {
    Serial.println("Zigbee failed to start!");
    Serial.println("Rebooting...");
    ESP.restart();
  } else {
    Serial.println("Zigbee started successfully!");
  }
  Serial.println("Connecting to network");
  while (!Zigbee.connected()) {
    Serial.print(".");
    delay(100);
  }
  Serial.println("Connected");
}

void loop() {
  // Checking button for factory reset and reporting
  if (digitalRead(button) == LOW) {  // Push button pressed
    // Key debounce handling
    delay(100);
    int startTime = millis();
    while (digitalRead(button) == LOW) {
      delay(50);
      if ((millis() - startTime) > 3000) {
        // If key pressed for more than 3secs, factory reset Zigbee and reboot
        Serial.println("Resetting Zigbee to factory and rebooting in 1s.");
        delay(1000);
        Zigbee.factoryReset();
      }
    }
    // For demonstration purposes, increment the multistate output/input value by 1 on short button press
    if (zbMultistateDeviceCustom.getMultistateOutput() < zbMultistateDeviceCustom.getMultistateOutputStateNamesLength() - 1) {
      zbMultistateDeviceCustom.setMultistateOutput(zbMultistateDeviceCustom.getMultistateOutput() + 1);
      zbMultistateDeviceCustom.reportMultistateOutput();
    } else {
      zbMultistateDeviceCustom.setMultistateOutput(0);
      zbMultistateDeviceCustom.reportMultistateOutput();
    }
  }
  delay(100);
}