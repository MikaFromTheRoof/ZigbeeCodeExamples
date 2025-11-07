const fz = require('zigbee-herdsman-converters/converters/fromZigbee');
const tz = require('zigbee-herdsman-converters/converters/toZigbee');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const ea = exposes.access;

//
// --- custom fromZigbee converter ---
//
const fzLocal = {
    multistate_output_custom: {
        cluster: 'genMultistateOutput',
        type: ['attributeReport', 'readResponse'],
        convert: (model, msg, publish, options, meta) => {
            const value = msg.data['presentValue'];
            const states = ['off', 'on', 'ultraslow', 'slow', 'fast', 'superfast'];
            console.log(`Received multistate output value: ${value} (${states[value] ?? 'unknown'})`);
            return { fan_mode: states[value] || `unknown_${value}` };
        },
    },
};

//
// --- Custom toZigbee converter ---
//
const tzLocal = {
    fan_mode: {
        key: ['fan_mode'],
        convertSet: async (entity, key, value, meta) => {
            const states = ['off', 'on', 'ultraslow', 'slow', 'fast', 'superfast'];
            const index = states.indexOf(value.toLowerCase());
            if (index === -1) throw new Error(`Invalid fan_mode: ${value}`);
            await entity.write('genMultistateOutput', { presentValue: index });
            return { fan_mode: value };
        },
    },
};

//
// --- Device definition ---
//
const definition = {
    fingerprint: [
        { modelID: 'ZigbeeMultistateDevice', manufacturerName: 'MikaFromTheRoof' },
    ],
    model: 'custom-multistate-device',
    vendor: 'MikaFromTheRoof',
    description: 'Custom Zigbee multistate fan mode device',
    fromZigbee: [fzLocal.multistate_output_custom],
    toZigbee: [tzLocal.fan_mode],
    exposes: [
        exposes.enum('fan_mode', ea.ALL, ['off', 'on', 'ultraslow', 'slow', 'fast', 'superfast'])
            .withDescription('Fan mode from custom multistate output'),
    ],
    endpoint: (device) => ({
        fan: 1,
    }),
    meta: { multiEndpoint: false },
    configure: async (device, coordinatorEndpoint) => {
        const endpoint = device.getEndpoint(1);

        await endpoint.bind('genMultistateOutput', coordinatorEndpoint);
        await endpoint.configureReporting('genMultistateOutput', [{
            attribute: 'presentValue',
            minimumReportInterval: 1,
            maximumReportInterval: 3600,
            reportableChange: 1,
        }]);

        console.log('Configured reporting for genMultistateOutput (endpoint 1)');
    },
};

module.exports = definition;