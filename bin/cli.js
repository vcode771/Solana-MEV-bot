#!/usr/bin/env node

const { startCLI } = require('../src/cli');

startCLI().catch(console.error); 