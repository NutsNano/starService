const fs = require('fs');
const path = require('path');
const mqtt = require('mqtt');
const uuid = require('uuid');

//const agentHelper = require('../helper/agent');

const defaultTimeoutInMs = 60000;

module.exports = class Controller {
  // deep copy for strings
  cloneString(s) {
    return (` ${s}`).slice(1);
  }

  // publishFunction
  senderFct = async (dataSource) => {
    const index = this.d2m.findIndex((v) => (v.dataSource === dataSource));
    if ( index !== -1 ) {
      const dataCount = this.d2m[index].data.length;
      if( this.d2m[index].mode === "forward" )
        this.d2m[index].index++;
      if( this.d2m[index].mode === "backward" )
        this.d2m[index].index--;
      if( this.d2m[index].index < 0 )
        this.d2m[index].index += dataCount;
      if( this.d2m[index].index >= dataCount )
        this.d2m[index].index -= dataCount;
      if( this.d2m[index].mode !== "pause"  && this.d2m[index].sendOut == true ) 
        this.d2m[index].client.publish( this.d2m[index].topic, JSON.stringify( this.d2m[index].data[this.d2m[index].index]) );
    }
  }

  // spawn agent from config
  spawnAgent(config, log) {
    const tmp = {};
    tmp.dataSource = ( config.dataSource != undefined ? config.dataSource : uuid.v4() );
    tmp.broker = this.cloneString( config.broker );
    tmp.topic = this.cloneString( config.topic );
    tmp.cycleTimeInMs = ( config.cycleTimeInMs != undefined ? config.cycleTimeInMs : 1000 );
    tmp.data = JSON.parse( JSON.stringify( config.data ) );
    tmp.index = ( config.index != undefined ? config.index : 0 );
    tmp.mode = ( config.mode != undefined ? config.mode : "still" );
    tmp.index = (tmp.index<0 ? 0 : (tmp.index>=tmp.data.length ? tmp.data.length-1 : tmp.index));
    tmp.ackTopic = tmp.topic + "/ack";
    tmp.actTimeoutValue = 0;
    tmp.sendOut = false;
    tmp.client = mqtt.connect( tmp.broker );
    tmp.client.on( 'error', (err) => {
      console.log(`connection error: ${err}`);
    }); //log.error(err); });
    tmp.client.on( 'connect', () => {
      //log.info( `connected to broker ${tmp.broker} in order to publish topic ${tmp.topic}` );
      console.log( `connected to broker ${tmp.broker} in order to publish topic ${tmp.topic}` );
      tmp.client.subscribe( tmp.ackTopic );
    });
    tmp.client.on( 'message', async (topic, message) => {
      if( topic === tmp.ackTopic ){
        var msgStr = message.toString();
        var msgJson = JSON.parse( msgStr );
        var timeoutValue = (msgJson.timer == undefined ? defaultTimeoutInMs : msgJson.timer*1000);
        if( timeoutValue > tmp.actTimeoutValue )
          tmp.actTimeoutValue = timeoutValue;
        tmp.sendOut	= true;
        clearTimeout( tmp.ackTimer );
        tmp.ackTimer = setTimeout( (tmp) => { 
          tmp.sendOut = false; 
          tmp.actTimeoutValue = 0; 
        }, tmp.actTimeoutValue, tmp );
      };
    });
    return tmp;
  }

  // add agent
  addAgent(config, log) {
    const tmp = this.spawnAgent(config, log);
    this.d2m.push(tmp);
    const index = this.d2m.findIndex((v) => (v.dataSource === tmp.dataSource));
    if (index !== -1) {
      this.d2m[index].timer = setInterval( this.senderFct, this.d2m[index].cycleTimeInMs, this.d2m[index].dataSource );
    }
    return tmp.dataSource;
  }

  readConfigFile(filePath, log) {
    fs.readFile(filePath, (err, data) => {
      //if (err) return;//{ this.log.info(`no such file: ${filePath}`); return; }
      if (err) { console.log(`no such file: ${filePath}`); return; }
      const cfgStruct = JSON.parse(data.toString());
      if (Array.isArray(cfgStruct)) {
        for (let i = 0; i < cfgStruct.length; i++) {
          this.addAgent(cfgStruct[i], log);
        }
      }
    });
  }

  constructor(log) {
    // global array for data2mqtt services
    this.d2m = [];
    // read and execute the config file
    this.readConfigFile(path.join(__dirname, '../../config.json'), log);
  }

  // config file format ('config.json'):
  // [
  //   {
  //     "dataSource":"nameOfTheDataSource",
  //     "broker":"mqtt://<IP>",
  //     "topic":"topicname",
  //     "cycleTimeInMs":1000,
  //     "data":[{...}],
  //     "index":0,
  //     "mode":"forward" | "backward" | "still" | "pause"
  //   }
  // ]

  // creation of new agents:
  // var cfg = { see above };
  // addAgent( cfg );

    // get configuration data from data2mqtt
    getAgents = async (req, res) => {
      const result = [];
      this.d2m.forEach((v) => {
        const tmp = {};
        tmp.dataSource = v.dataSource;
        tmp.broker = v.broker;
        tmp.topic = v.topic;
        tmp.cycleTimeInMs = v.cycleTimeInMs;
        tmp.lengthOfDataField = v.data.length;
        tmp.index = v.index;
        tmp.mode = v.mode;
        result.push(tmp);
      });
      res.set({ "Access-Control-Allow-Origin": "*" });
      res.set({ 'Content-Type': 'application/json' });
      res.status(200).send(JSON.stringify(result));
    }

    // create data2mqtt agent
    createAgent = async (req, res) => {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Content-Type", "application/json");
        if (req.body === undefined) {
        res.status(400).send(JSON.stringify('No config data provided'));
        return;
      }
      if (req.body.broker === undefined) {
        res.status(400).send(JSON.stringify('No broker provided'));
        return;
      }
      if (req.body.topic === undefined) {
        res.status(400).send(JSON.stringify('No topic provided'));
        return;
      }
      if (req.body.data === undefined) {
        res.status(400).send(JSON.stringify('No data provided'));
        return;
      }
      if (req.body.dataSource !== undefined && 
          this.d2m.findIndex((v) => (v.dataSource === req.body.dataSource)) !== -1 ) {
        res.status(400).send(JSON.stringify('dataSource already existing'));
        return;
      }
      const dataSource = this.addAgent(req.body);
      res.status(200).send(JSON.stringify(dataSource));
    }

    // reconfigure agent
    reconfigureAgent = async (req, res) => {
      const index = this.d2m.findIndex((v) => (v.dataSource === req.params.dataSource));
      if (index === -1) {
        res.set({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.status(400).send(JSON.stringify('dataSource not found'));
        return;
      }
      if( req.body != undefined ){
        if( req.body.cycleTimeInMs != undefined )
          this.d2m[index].cycleTimeInMs = req.body.cycleTimeInMs;
        if( req.body.index != undefined )
          this.d2m[index].index = req.body.index;
        if( req.body.mode != undefined )
          this.d2m[index].mode = req.body.mode;
        if( req.body.data != undefined )
          this.d2m[index].data = JSON.parse( JSON.stringify( req.body.data ) );
        if( this.d2m[index].index < 0)
          this.d2m[index].index = 0;
        if( this.d2m[index].index >= this.d2m[index].data.length )
          this.d2m[index].index = this.d2m[index].data.length - 1;
      }
      res.set({ 'Content-Type': 'application/json' });
      res.status(200).send(JSON.stringify(req.params.dataSource));
    }

    // delete agent
    deleteAgent = async (req, res) => {
      const index = this.d2m.findIndex((v) => (v.dataSource === req.params.dataSource));
      if (index === -1) {
        res.set({ 'Content-Type': 'application/json' });
        res.status(400).send(JSON.stringify('dataSource not found'));
        return;
      }
      clearInterval( this.d2m[index].timer );
      clearTimeout( this.d2m[index].ackTimer );
      this.d2m[index].client.end();
      this.d2m.splice(index, 1);
      res.set({ 'Content-Type': 'application/json' });
      res.status(200).send(JSON.stringify(req.params.dataSource));
    }
};
