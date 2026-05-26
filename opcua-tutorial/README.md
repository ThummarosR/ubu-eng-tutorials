# OPC UA Tutorial

Ten-chapter Thai-language tutorial on **IEC 62541 / OPC UA** and its role
in Industrie 4.0. Year 3–4 follow-on to the PLC + Modbus tracks. Used in
the *Mechatronics & Automotive Engineering* programme at UBU.

Static HTML — open `index.html` in a browser, or serve the folder with any
static-file server.

## Chapters

1. Why OPC UA — context, problems with traditional fieldbus
2. Architecture — client/server, sessions, secure channels
3. Information Model — nodes, references, address space
4. Services — read/write/browse, history, alarms
5. PubSub — UDP/MQTT publish-subscribe extension
6. Security — certificates, authentication, encryption
7. Companion Specifications — Robotics, Auto-ID, FX
8. Field Level — OPC UA FX and TSN
9. Cloud — Sparkplug, OPC UA + Azure / AWS / SAP
10. Hands-on — lab setup with UaExpert + Prosys Simulation Server

## Software you'll need for the lab (Chapter 10)

Both are free for non-commercial use:

- **UaExpert** (Unified Automation, free client) —
  https://www.unified-automation.com/products/development-tools/uaexpert.html
- **Prosys OPC UA Simulation Server** (free) —
  https://www.prosysopc.com/products/opc-ua-simulation-server/

This tutorial only references these tools; their installers are not
redistributed here.

## Live version

The canonical hosted version is on the [Mechatronics Engineering program
website](https://mechatronics-website-655397920844.asia-southeast1.run.app/tutorials).

## License + acknowledgements

Tutorial text and HTML: Apache 2.0 — see [../LICENSE](../LICENSE).

The OPC UA specification itself (IEC 62541) is published by the IEC and the
OPC Foundation; this tutorial summarises and references the spec but does
not reproduce it. UaExpert and the Prosys Simulation Server are products of
Unified Automation and Prosys OPC respectively.
