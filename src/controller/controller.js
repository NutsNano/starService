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
      x: -xRes,
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
    tmp.starCoords = [];
    var nos = this.star.length;
    for( var i=0; i<nos; i++ ){
      var coords = this.calcCoordinates( this.star[i] );
      var starTmp = [coords.x, coords.y, Number( this.star[i][13] )];
      tmp.starCoords.push( starTmp );
    }
    this.session.push( tmp );
    console.log("New session: "+tmp.UUID);
    return tmp.UUID;
  }

  findStarByCoordinates( starCoords, x, y, mag ){
    var candidate = {
      index: -1,
      dist: 10
    }
    var nos = starCoords.length;
    for( var i=0; i<nos; i++ ){
      if( starCoords[i][2] <= mag ){
        var dist = Math.abs( x-starCoords[i][0] ) + Math.abs(y-starCoords[i][1] );
        if( dist<candidate.dist ){
          candidate.dist = dist;
          candidate.index = i; 
        } 
      }
    }
    return candidate.index;
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
        res.status(200).send(JSON.stringify(req.body.UUID));
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
      var all = true;
      if( req.query.type !== undefined && req.query.type === "primary" )
        all = false;
      var starCounter = this.session[index].maxResult;
      var minMag = this.session[index].minMag;
      const result = [];
      this.star.forEach((v) => {
        if (starCounter>0 && v[29]==req.query.constellation && Number(v[13])<minMag){
          if( all || v[27] !== "" ){
            var tmp = this.calcCoordinates( v );
            starCounter--;
            result.push( tmp );
          }
        }
      });
      res.set({ "Access-Control-Allow-Origin": "*" });
      res.set({ 'Content-Type': 'application/json' });
      res.status(200).send(JSON.stringify(result));
    }

    // find star data from starService
    findStar = async (req, res) => {
      // console.log("here: find Star");
      res.set({ "Access-Control-Allow-Origin": "*" });
      res.set({ 'Content-Type': 'application/json' });
      const index = this.session.findIndex((v) => (v.UUID === req.params.session));
      if (index === -1) {
        res.set({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.status(400).send(JSON.stringify('session not found'));
        // console.log("no valid session");
        return;
      }
      if (req.query.x == undefined || req.query.y == undefined) {
        res.set({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.status(400).send(JSON.stringify('no coordinates provided'));
        // console.log("no x or y coordinates");
        return;
      }
      var starIndex = this.findStarByCoordinates(
        this.session[index].starCoords,
        req.query.x,
        req.query.y,
        this.session[index].minMag );
      var result = { index: -1, bf: "", proper: "", mag: 0, con: "",x: 0, y: 0, z: 0 };
      if( starIndex != -1 ){
        result = {
          index: starIndex,
          bf: this.star[starIndex][5],
          proper: this.star[starIndex][6],
          mag: Number( this.star[starIndex][13] ),
          con: this.star[starIndex][29],
          beyer: this.star[starIndex][27],
          x: Number( this.star[starIndex][17]),
          y: Number( this.star[starIndex][18]),
          z: Number( this.star[starIndex][19])
        }
      }  
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
