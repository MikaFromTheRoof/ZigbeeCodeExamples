// Import the default Zigbee2MQTT "fromZigbee" converters (used for parsing incoming Zigbee messages)
const fz = require('zigbee-herdsman-converters/converters/fromZigbee');
// Import the default Zigbee2MQTT "toZigbee" converters (used for sending commands to the device)
const tz = require('zigbee-herdsman-converters/converters/toZigbee');
// Import the expose feature builder (used to define entities and features shown in Home Assistant)
const exposes = require('zigbee-herdsman-converters/lib/exposes');
// Shortcut for access permissions (read/write) for exposes
const ea = exposes.access;

//
// --- Custom fromZigbee converter ---
// (Handles incoming Zigbee attribute reports for genMultistateOutput)
//
const fzLocal = {
    multistate_output_custom: {
        // The Zigbee cluster this converter listens to (Multistate Output cluster)
        cluster: 'genMultistateOutput',
        // Types of messages this converter should process: attribute reports and read responses
        type: ['attributeReport', 'readResponse'],
        // Convert the incoming Zigbee payload (numbers from 0 to 5 representing the 6 states) to a friendly property for MQTT/HA
        convert: (model, msg, publish, options, meta) => {
            // Extract the presentValue attribute sent by the device
            const value = msg.data['presentValue'];
            // Define the mapping of the numeric values to string states
            const states = ['off', 'on', 'ultraslow', 'slow', 'fast', 'superfast'];
            // Log the received value and resolved state to the Zigbee2MQTT log
            console.log(`Received multistate output value: ${value} (${states[value] ?? 'unknown'})`);
            // Return the fan_mode property with the mapped string state
            // The property needs to have the same name as the exposed 'fan_mode' (see below)
            return { fan_mode: states[value] || `unknown_${value}` };
        },
    },
};

//
// --- Custom toZigbee converter ---
// (Allows Home Assistant / MQTT to send fan_mode commands to the device)
//
const tzLocal = {
    fan_mode: {
        // The key name of the MQTT payload that gets send from Home Assistant
        // Needs to equal the exposed 'fan_mode' (see below)
        key: ['fan_mode'],
        // Convert the requested fan_mode string to a Zigbee write command
        convertSet: async (entity, key, value, meta) => {
            // List of valid states in the same order as defined for fromZigbee
            const states = ['off', 'on', 'ultraslow', 'slow', 'fast', 'superfast'];
            // Convert the requested value to lowercase and find its index
            const index = states.indexOf(value.toLowerCase());
            // If the value is not valid, throw an error
            if (index === -1) throw new Error(`Invalid fan_mode: ${value}`);
            // Write the mapped index to the Multistate Output cluster as presentValue
            await entity.write('genMultistateOutput', { presentValue: index });
            // Return the new value so Zigbee2MQTT updates its state immediately
            return { fan_mode: value };
        },
    },
};

//
// --- Device definition for Zigbee2MQTT ---
//
const definition = {
    // Identify the device based on model ID and manufacturer (so Zigbee2MQTT knows when to use this converter)
    fingerprint: [
        { modelID: 'ZigbeeMultistateDevice', manufacturerName: 'MikaFromTheRoof' },
    ],
    // Internal model name for Zigbee2MQTT
    model: 'custom-multistate-device',
    // Vendor name shown in UI
    vendor: 'MikaFromTheRoof',
    // Description shown in UI
    description: 'Custom Zigbee multistate fan mode device',

    // Register our custom fromZigbee and toZigbee converters
    fromZigbee: [fzLocal.multistate_output_custom],
    toZigbee: [tzLocal.fan_mode],

    // Expose a fan_mode enum to Home Assistant so it appears as a selectable control
    exposes: [
        exposes.enum('fan_mode', ea.ALL, ['off', 'on', 'ultraslow', 'slow', 'fast', 'superfast'])
            .withDescription('Fan mode from custom multistate output'),
    ],

    // Name (or label) endpoint 1 as "fan"
    endpoint: (device) => ({
        fan: 1,
    }),

    // Indicate that this device does not use multiple endpoints
    meta: { multiEndpoint: false },

    // Configure Zigbee bindings and attribute reporting when the device pairs
    configure: async (device, coordinatorEndpoint) => {
        // Get endpoint 1 where the Multistate Output cluster lives
        const endpoint = device.getEndpoint(1);

        // Bind the Multistate Output cluster to the coordinator so that reports are sent automatically
        await endpoint.bind('genMultistateOutput', coordinatorEndpoint);

        // Configure automatic reporting for presentValue
        await endpoint.configureReporting('genMultistateOutput', [{
            attribute: 'presentValue',  // attribute to report
            minimumReportInterval: 1,   // min time (s) between reports
            maximumReportInterval: 3600,// max time (s) between reports
            reportableChange: 1,        // report when value changes by at least 1
        }]);

        // Log that configuration is complete
        console.log('Configured reporting for genMultistateOutput (endpoint 1)');
    },
};

// Export the definition so Zigbee2MQTT can load it as an external converter
module.exports = definition;