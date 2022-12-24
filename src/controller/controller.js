const fs = require('fs');
const path = require('path');
const mqtt = require('mqtt');
const uuid = require('uuid');
const parseMe = require('csv-parse').parse;

const defaultTimeoutInMs = 60000;

module.exports = class Controller {
  
  // read star file
  readStarFile(filePath, log) {
    fs.readFile(filePath, (err, data) => {
      if (err) { console.log(`no such file: ${filePath}`); return; }
      parseMe( data.toString(), {comment: '#'},(err, records)=>{
        records.splice(0,2);
        this.star = JSON.parse(JSON.stringify(records));
      })
    });
  }

  calcCoordinates( star ) {
    let x = Number(star[17]);
    let y = Number(star[18]);
    let z = Number(star[19]);
    let phi = Math.acos(z / Math.sqrt( x*x + y*y + z*z));
    let lenXY = Math.sqrt(x*x + y*y);
    let factor = phi / (lenXY * Math.PI);
    var xRes = x * factor;
    var yRes = y * factor;
    var result = {
      x: xRes,
      y: yRes,
      mag: Number(star[13])
    };
    return result;
  }

  // add session
  addSession(config, log) {
    var tmp = {};
    tmp.UUID = (config.UUID==undefined ? uuid.v4() : config.UUID);
    tmp.owner = (config.owner==undefined ? "johnDoe" : config.owner);
    tmp.maxResult = (config.maxResult==undefined ? 200 : config.maxResult);
    tmp.minMag = (config.minMag==undefined ? 5 : config.minMag);
    this.session.push( tmp );
    return tmp.UUID;
  }

  constructor(log) {
    // global array for star data
    this.star = [];
    // global array for active session
    this.session = [];
    // read and execute the config file
    this.readStarFile(path.join(__dirname, '../../starFile.csv'), log);
  }

  // config format:
  // [
  //   {
  //     "UUID":"sessionUuid",
  //     "owner":"name",
  //     "maxResult":maxNumberOfStarDataSets,
  //     "minMag":magnitudeThreshold
  //   }
  // ]

    // get constellations from starService
    getConstellations = async (req, res) => {
      res.set({ "Access-Control-Allow-Origin": "*" });
      res.set({ 'Content-Type': 'application/json' });
      var result = [];
      this.star.forEach((v) => {
        if( v[29] !== '' ) {
          if( result.findIndex((c) => (c === v[29])) == -1)
            result.push( v[29] );
        }
      });
      res.status(200).send(JSON.stringify(result));
    }

    // get configuration data from starService
    getSessions = async (req, res) => {
      res.set({ "Access-Control-Allow-Origin": "*" });
      res.set({ 'Content-Type': 'application/json' });
      const result = [];
      this.session.forEach((v) => {
        const tmp = {};
        tmp.UUID = v.UUID;
        tmp.owner = v.owner;
        tmp.maxResult = v.maxResult;
        tmp.minMag = v.minMag;
        result.push(tmp);
      });
      res.status(200).send(JSON.stringify(result));
    }

    // get configuration data from session
    getSession = async (req, res) => {
      res.set({ "Access-Control-Allow-Origin": "*" });
      res.set({ 'Content-Type': 'application/json' });
      const index = this.session.findIndex((v) => (v.UUID === req.params.session));
      if (index === -1) {
        res.set({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.status(400).send(JSON.stringify('session not found'));
        return;
      }
      const result = {};
      result.UUID = v.UUID;
      result.owner = v.owner;
      result.maxResult = v.maxResult;
      result.minMag = v.minMag;
      res.status(200).send(JSON.stringify(result));
    }

    // create starService session
    createSession = async (req, res) => {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Content-Type", "application/json");
        if (req.body === undefined) {
        res.status(400).send(JSON.stringify('No config data provided'));
        return;
      }
      if (req.body.UUID !== undefined && 
          this.session.findIndex((v) => (v.UUID === req.body.UUID)) !== -1 ) {
        res.status(400).send(JSON.stringify('session is already existing'));
        return;
      }
      const uuid = this.addSession(req.body);
      res.status(200).send(JSON.stringify(uuid));
    }

    // get star data from starService
    getStar = async (req, res) => {
      res.set({ "Access-Control-Allow-Origin": "*" });
      res.set({ 'Content-Type': 'application/json' });
      const index = this.session.findIndex((v) => (v.UUID === req.params.session));
      if (index === -1) {
        res.set({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.status(400).send(JSON.stringify('session not found'));
        return;
      }
      if (req.query.constellation == undefined) {
        res.set({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.status(400).send(JSON.stringify('no constellation provided'));
        return;
      }
      var starCounter = this.session[index].maxResult;
      var minMag = this.session[index].minMag;
      const result = [];
      this.star.forEach((v) => {
        if (starCounter>0 && v[29]==req.query.constellation && Number(v[13])<minMag){
          var tmp = this.calcCoordinates( v );
          starCounter--;
          result.push( tmp );
        }
      });
      res.set({ "Access-Control-Allow-Origin": "*" });
      res.set({ 'Content-Type': 'application/json' });
      res.status(200).send(JSON.stringify(result));
    }

    // reconfigure session
    reconfigureSession = async (req, res) => {
      const index = this.session.findIndex((v) => (v.UUID === req.params.session));
      if (index === -1) {
        res.set({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.status(400).send(JSON.stringify('session not found'));
        return;
      }
      if( req.body != undefined ){
        if( req.body.owner != undefined )
          this.session[index].owner = req.body.owner;
        if( req.body.maxResult != undefined )
          this.session[index].maxResult = req.body.maxResult;
        if( req.body.minMag != undefined )
          this.session[index].minMag = req.body.minMag;
      }
      res.set({ 'Content-Type': 'application/json' });
      res.status(200).send(JSON.stringify(req.params.session));
    }

    // delete session
    deleteSession = async (req, res) => {
      res.set({ "Access-Control-Allow-Origin": "*" });
      res.set({ 'Content-Type': 'application/json' });
      const index = this.session.findIndex((v) => (v.UUID === req.params.session));
      if (index === -1) {
        res.set({ 'Content-Type': 'application/json' });
        res.status(400).send(JSON.stringify('session not found'));
        return;
      }
      this.session.splice(index, 1);
      res.status(200).send(JSON.stringify(req.params.session));
    }
};
