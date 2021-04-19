/*
Layer Payment SDK for Node Js
*/
var express = require('express');
var session = require('express-session');
var app = express();
var bodyParser = require('body-parser');
var path = require('path');
var crypto = require('crypto');
var reqpost = require('request'); //required for verify payment

app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({secret: 'mcg001k',saveUninitialized: true,resave: true}));
app.use(express.static(__dirname + '/'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', __dirname);

var error = "";
var html = "";
var config = require("./config.json"); //Load config parameters

const BASE_URL_SANDBOX = "https://sandbox-icp-api.bankopen.co/api";
const BASE_URL_UAT = "https://icp-api.bankopen.co/api";

//Generate random txnid
app.get('/', function(req,res) {	
	var txn = JSON.stringify(Math.random()*1000);
	var i = txn.indexOf('.');
	txn = txn.substr(0,i);
	config.sample_data.mtx = txn;
	
	var payment_token_data;			
	create_payment_token(config.sample_data,
		config.accesskey,
		config.secretkey,
		config.environment,function(layer_payment_token_data) {				
		/*Object.keys(layer_payment_token_data).forEach(function(key) {
			console.log(key + layer_payment_token_data[key]);
		});*/
				
		if(typeof layer_payment_token_data['error']!='  ')
			res.end(JSON.stringify('E55 Payment error. ' + layer_payment_token_data['error']));  
		
		if(typeof layer_payment_token_data["id"]=='undefined' || !layer_payment_token_data["id"]) 
			res.end(JSON.stringify('Payment error. ' + 'Layer token ID cannot be empty.'));        
				
		if(!error && typeof layer_payment_token_data["id"]!='undefined') {
				
			get_payment_token(layer_payment_token_data["id"],config.accesskey,config.secretkey,config.environment,function(payment_token_data){
						
				payment_token_data = JSON.parse(payment_token_data);
						
				if(typeof payment_token_data['error']!='undefined')
					res.end(JSON.stringify('E56 Payment error. ' + payment_token_data['error']));            
        		if(typeof payment_token_data['status']!='undefined' && payment_token_data['status'] == "paid")
					res.end(JSON.stringify("Layer: this order has already been paid."));            
						
				if(parseFloat(payment_token_data['amount']) != parseFloat(config.sample_data.amount))
					res.end(JSON.stringify("Layer: an amount mismatch occurred."));
						
				var hash = create_hash({
					'layer_pay_token_id'   : payment_token_data['id'],
					'layer_order_amount'   : payment_token_data['amount'],
					'tranid'    : config.sample_data.mtx,
				},config.accesskey,config.secretkey,config.environment);
						
				var html =  "<form action='./response.html' method='post' style='display: none' name='layer_payment_int_form'>";
				html +="<input type='hidden' name='layer_pay_token_id' value='" + payment_token_data['id']+"'>";
				html +="<input type='hidden' name='tranid' value='"+ config.sample_data.mtx +"'>";
				html +="<input type='hidden' name='layer_order_amount' value='"+payment_token_data['amount']+"'>";
				html +="<input type='hidden' id='layer_payment_id' name='layer_payment_id' value=''>";
				html +="<input type='hidden' id='fallback_url' name='fallback_url' value=''>";
				html +="<input type='hidden' name='hash' value='"+hash+"'></form>";
				html += "<script>";
				html += "var layer_params = {payment_token_id:'" +payment_token_data['id']+"',accesskey:'"+config.accesskey+"'};"; 
				html +="</script>";
				html += '<script src="./layer_checkout.js"></script>';
				
				res.render(__dirname + '/checkout.html', {
					data:config,
					tokenid:payment_token_data['id'],					
					amount: payment_token_data['amount'],
					hash: hash
					});	
			});
		}		
	});	
});

app.post('/response.html', function(req, res){
	var txnid="";
	var amount="";
	var status="";
	var msg="";
	var tokenid="";
	var paymentid = "";
	
	if(!req.body.layer_payment_id){
		res.render(__dirname + '/response.html', {status:'invalid response'});
	}
	else {
		txnid = req.body.tranid;
		amount = req.body.layer_order_amount;
		tokenid = req.body.layer_pay_token_id;
		paymentid = req.body.layer_payment_id;
	}
	var data = {
        'layer_pay_token_id' : tokenid,
        'layer_order_amount' : amount,
        'tranid'     	 : txnid,
    };
	
	if(verify_hash(data,req.body.hash,config.accesskey,config.secretkey,config.environment)) {
		get_payment_details(paymentid,config.accesskey,config.secretkey,config.environment,function(response){
			if(response === "{}"){
				res.render(__dirname + '/response.html', {status: 'Empty response received'});				
			}
			else {
				payment_data = JSON.parse(response);
				if(payment_data['payment_token']['id'] != tokenid){					
					res.render(__dirname + '/response.html', {status: "Layer: received layer_pay_token_id and collected layer_pay_token_id doesnt match"});				
				}
				else if(parseFloat(config.sample_data.amount) != parseFloat(payment_data['amount'])){
					res.render(__dirname + '/response.html', {status: "Layer: received amount and collected amount doesnt match"});					
				}
				else {
					res.render(__dirname + '/response.html', {status: "Transaction successful..."});					
				}
			}
		});		
	}				
});

//Layer functions
function create_payment_token(data,accesskey,secretkey,environment,callback){
    try {
        var pay_token_request_data = {
            'amount'   			: (data['amount'])			? data['amount'] 		: null,
            'currency' 			: (data['currency'])		? data['currency'] 		: null,
            'name'     			: (data['name'])			? data['name'] 			: null,
            'email_id' 			: (data['email_id'])		? data['email_id'] 		: null,
            'contact_number' 	: (data['contact_number'])	? data['contact_number']: null,
            'mtx'    			: (data['mtx'])				? data['mtx'] 			: null,
            'udf'    			: (data['udf'])				? data['udf'] 			: null,
        };
		http_post(pay_token_request_data,"payment_token",accesskey,secretkey,environment,function(response){
			return callback(response);			
		});

	} catch (e){			
        return callback({
            'error' : e
        });
    } 
}

function get_payment_token(payment_token_id,accesskey,secretkey,environment,callback){
    if(!payment_token_id){
        throw new Error("payment_token_id cannot be empty");
    }

    try {
        http_get("payment_token/" + payment_token_id,accesskey,secretkey,environment,function(response){
			return callback(response);
		});
    } catch (e){
        return callback({
			'error' : e
        });
    } 
}

function get_payment_details(payment_id,accesskey,secretkey,environment,callback){

    if(!payment_id){
        throw new Error("payment_id cannot be empty");
    }
    try {
        http_get("payment/"+payment_id,accesskey,secretkey,environment,function(response) {
			return callback(response);
		});
    } catch (e){
        return {
			'error' : e
        };
    } 
}

function http_post(data,route,accesskey,secretkey,environment,callback){
	Object.keys(data).forEach(function(key) {
		if(data[key]===null)
			delete data[key];	
	});
    
	var url = BASE_URL_SANDBOX + "/" + route;
	
    if(environment == 'live'){
        url = BASE_URL_UAT + "/" + route;
    } 
	
	var options = {
		method: 'POST',
		uri: url,
		json: true,
		form: {
			amount:data['amount'],
			currency:data['currency'],
			name:data['name'],
			email_id:data['email_id'],
			contact_number:data['contact_number'],
			mtx:data['mtx']
		},
		headers: {
			'Content-Type': 'application/json',                                 
			'Authorization': 'Bearer '+accesskey +':'+ secretkey
		}
	};
    	
    reqpost(options)
		.on('response', function (resp) {
			//console.log('STATUS:'+resp.statusCode);
			resp.setEncoding('utf8');
			resp.on('data', function (chunk) {					
				var data = JSON.parse(chunk);
				var rdata = "";
				if("error" in data)
				{
					Object.keys(data).forEach(function(key) {						
						if(key =="error_data") {
							var obj = data[key];
							Object.keys(obj).forEach(function(k) {
								rdata += obj[k]+' ';
							});
						}
					});					
					return callback({"error":rdata});
				}
				else
					return callback(data);					
				
			});
		})
		.on('error', function (err) {			
			return callback(err);
		});		
}

function http_get(route,accesskey,secretkey,environment,callback){
	
	var url = BASE_URL_SANDBOX + "/" + route;
	
    if(environment == 'live'){
        url = BASE_URL_UAT + "/" + route;
    } 
		
	var options = {
		method: 'GET',
		uri: url,		
		headers: {
			'Content-Type': 'application/json',                                 
			'Authorization': 'Bearer '+accesskey +':'+ secretkey
		}
	};
    
    reqpost(options)
		.on('response', function (resp) {			
			resp.setEncoding('utf8');
			resp.on('data', function (chunk) {					
				return callback(chunk);
			});
		})
		.on('error', function (err) {
			return callback(err);
		});	        
}

function create_hash(data,accesskey,secretkey){
    data = ksort(data);
    hash_string = accesskey;
	Object.keys(data).forEach(function(key) {
		hash_string += '|' + data[key];
	});
    var cryp = crypto.createHash('sha256',secretkey);
	cryp.update(hash_string);
	return cryp.digest('hex');    
}

function verify_hash(data,rec_hash,accesskey,secretkey){
    var gen_hash = create_hash(data,accesskey,secretkey);
    if(gen_hash === rec_hash){
        return true;
    }
    return false;
}

function ksort(obj){
  var keys = Object.keys(obj).sort(), sortedObj = {};

  for(var i in keys) {
    sortedObj[keys[i]] = obj[keys[i]];
  }

  return sortedObj;
}
app.listen(3000);