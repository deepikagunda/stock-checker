/*
 *
 *
 *       Complete the API routing below
 *
 *
 */

"use strict";

var expect = require("chai").expect;
var MongoClient = require("mongodb");
const got = require("got");
var ObjectId = require("mongodb").ObjectId;
var mongoose = require("mongoose");
let db;
var bodyparser = require("body-parser");
console.log(process.env.MLAB_URI);
mongoose.connect(
  process.env.MLAB_URI,
  { useNewUrlParser: true }
);
var Schema = mongoose.Schema;

var stockSchema = new Schema({
  stock: { type: String, required: true },
  price: { type: Number },
  likes: { type: [String] }
});
var Stock = mongoose.model("Stock", stockSchema);

//given a stock ,check if the stock is present in db
//if not present ,insert into db ,the stock price from external api.Add like with ip if like is true
//if present,and like is true,check whehter ip is in likes .then just return ,otherwise update like and return
async function updateDB(ticker, like, ip) {
  //console.log(ticker+like+ip);
  let doc = await Stock.findOne({ stock: ticker });

  if (doc) {
    //stock exists in db .
    //get the ip address of who posted the like .if that like is not already present ,then update.
    if (like) {
      if (!doc.likes.includes(ip)) {
        //insert into db.
        doc.likes.push(ip);
        let newdoc = await doc.save();

        console.log("end of like insert");
        console.log(newdoc);
        return ({
          stock: newdoc.stock,
          price: newdoc.price,
          likes: newdoc.likes.length
        });
        //res.json({'stock':ticker,'price':doc.price,'likes':newdoc.likes.length});
      }
      else
      {
        return ({'stock':ticker,'price':doc.price,'likes':doc.likes.length});
      }
    } else {
      if ("likes" in doc) {
        return ({ stock: ticker, price: doc.price, likes: doc.likes.length });
      } else {
        return ({ stock: ticker, price: doc.price, likes: 0 });
      }
    }
  } else {
    //make the query ,get value ,store in db n send result .
    let response = await got(
      "https://api.iextrading.com/1.0/stock/" + ticker + "/price",
      {
        json: true
      }
    );

    console.log(response.body);
    if (!isNaN(response.body)) {
      if (like) {
        let doc1 = await Stock.create({
          stock: ticker,
          price: response.body,
          likes: [ip]
        });
        console.log(doc1);
        return ({ stock: ticker, price: doc1.price, likes: 1 });
      } else {
        let doc1 = await Stock.create({ stock: ticker, price: response.body });
          console.log(doc1);
          return ({ stock: ticker, price: doc1.price, likes: 0 });
      }

      //res.json({'stock':ticker,'price':response.body});
    } else {
      console.log("here in err");
      return { error: "Unknown stock " };
    }
  } //end of else
}

module.exports = function(app) {
  app.route("/api/stock-prices").get(function(req, res) {
    //https://api.iextrading.com/1.0/stock/STOCK_NAME/price Unknown symbol 1075.57
    var ticker = req.query.stock;
    var like = req.query.like;
    console.log("like" + like);
    if (typeof ticker == "string") {
      //var like = req.query.like;
      // console.log('ticker'+ticker);
      (async () => {
        let result = await updateDB(ticker, like, req.ip);
        if ("error" in result) {
          res.json(result);
        } else {
          res.json({ stockData: result });
        }
      })().catch(err => {
        console.error(err);
      });
    } else {
      //get 2 stock prices
      console.log("ticker");

      (async () => {
        //console.log(like);
        let result1 = await updateDB(ticker[0], like, req.ip);
        console.log("result1 after await" + JSON.stringify(result1));
        let result2 = await updateDB(ticker[1], like, req.ip);
        console.log("result2 after await" + JSON.stringify(result2));
        //now take both results ,find relative likes and send back the result.
        //{"stockData":[{"stock":"MSFT","price":"62.30","rel_likes":-1},{"stock":"GOOG","price":"786.90","rel_likes":1}]}
        let resultarr = [];
        if (!("error" in result1) && !("error" in result2)) {
          result1.rel_likes = result1.likes - result2.likes;
          result2.rel_likes = result2.likes - result1.likes;
          delete result1.likes;
          delete result2.likes;
          resultarr.push(result1, result2);
          console.log(resultarr);
          res.json({ stockData: resultarr });
        } else {
          res.json({ error: "unknown stock" });
        }
      })().catch(err => {
        console.error(err);
      });
    }
  });
};
