// This loads the environment variables from the .env file
require('dotenv-extended').load();

var builder = require('botbuilder');
var restify = require('restify');
var Swagger = require('swagger-client');
var Promise = require('bluebird');
var url = require('url');
var fs = require('fs');
var util = require('util');
var remotepng = require('./remotepng');
var redis = require('redis');
var client = redis.createClient(6379, 'tradingbot.redis.cache.windows.net', { no_ready_check: true });
client.auth('pm/THZHkMq0u1SfLfuVDNBhDT/v/J5Flu0EpsrLXos4=', function (err) {
    if (err) throw err;
});

client.on("error", function (err) {
    console.log("Error " + err);
});

client.on('connect', function () {
    console.log('Connected to Redis');
});

// Swagger client for Bot Connector API
var connectorApiClient = new Swagger(
    {
        url: 'https://raw.githubusercontent.com/Microsoft/BotBuilder/master/CSharp/Library/Microsoft.Bot.Connector.Shared/Swagger/ConnectorAPI.json',
        usePromise: true
    });

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

//=========================================================
// Functions
//=========================================================

function redisGetSymbol(key, session) {
    client.get(key, function (err, reply) {
        if (err) throw err;
        console.log(reply.toString());
        var url = 'http://info512.taifex.com.tw/Future/chart.aspx?type=1&size=630400&contract=' + reply.toString() + '&CommodityName=%E8%87%BA%E6%8C%87%E9%81%B8';
        sendInternetUrl(session, url, 'image/gif', '期貨交易資訊');
    });
}

function redisGetSymbol1(key, session) {
    client.get(key, function (err, reply) {
        if (err) throw err;
        console.log(reply.toString());
        var yyyymm = new Date().getFullYear() + reply.toString().substring(2, 4);;
        remotepng.shotpng('https://tw.screener.finance.yahoo.net/future/aa03?opmr=optionpart&opcm=WTXO&opym=' + yyyymm, 'options.png').then(function () {
            sendInline(session, './images/options.png', 'image/png', '選擇權報價');
        });
    });
}

function redisGetOptions(key, session) {
    client.get(key, function (err, reply) {
        if (err) throw err;
        console.log(reply.toString());
        var suggest = reply.toString();
        var result = suggest.split(";");
        if (result[0] === '0') {
            session.endDialog('目前暫無選擇權投資建議！');
        } else {
            remotepng.shotpng1('http://tradingbot.azurewebsites.net/options' + result[0] + '.html', 'options_suggest.png').then(function () {
                sendInline(session, './images/options_suggest.png', 'image/png', '選擇權投資建議');
            });
        }
    });
}

function redisGetSymbol1W(key, session) {
    client.get(key, function (err, reply) {
        if (err) throw err;
        console.log(reply.toString());
        var yyyymm = reply.toString()
        remotepng.shotpng('https://tw.screener.finance.yahoo.net/future/aa03?opmr=optionpart&opcm=WTXO&opym=' + yyyymm, 'optionsw.png').then(function () {
            sendInline(session, './images/optionsw.png', 'image/png', '選擇權報價');
        });
    });
}

function redisGetReal(key, session) {
    client.get(key, function (err, reply) {
        if (err) throw err;
        console.log(reply.toString());
        session.send(reply.toString());
    });
}

function redisGetOI(key, session) {
    client.get(key, function (err, reply) {
        if (err) throw err;
        console.log(reply.toString());
        session.endDialog(reply.toString());
    });
}

function redisGetREAL(key, session) {
    client.get(key, function (err, reply) {
        if (err) throw err;
        console.log(reply.toString());
        session.endDialog(reply.toString());
    });
}

//=========================================================
// Bots Middleware
//=========================================================

// Anytime the major version is incremented any existing conversations will be restarted.
bot.use(builder.Middleware.dialogVersion({ version: 1.0, resetCommand: /^reset/i }));
//=========================================================
// Bots Global Actions
//=========================================================

bot.endConversationAction('goodbye', '再見囉～歡迎來信指教 tradingbot.tw@gmail.com 期待再次使用！', { matches: [/^goodbye/i, /\u96e2\u958b/, /\u518D\u898B/] });
bot.beginDialogAction('help', '/help', { matches: [/^help/i, /\u5e6b\u5fd9/, /\u6c42\u52a9/, /\u5e6b\u52a9/] });
bot.beginDialogAction('menu', '/menu', { matches: [/^menu/i, /\u9078\u55ae/, /\u6e05\u55ae/] });

//=========================================================
// Bots Dialogs
//=========================================================

bot.dialog('/', [
    function (session) {
        // Send a greeting and show help.
        var card = new builder.HeroCard(session)
            .title("TradingBot")
            .text("訣竅提醒-有快速選項在右下角。")
            .images([
                builder.CardImage.create(session, "https://cloud.githubusercontent.com/assets/664465/25264522/249d9720-269a-11e7-9308-8274c496a072.png")
            ]);
        var msg = new builder.Message(session).attachments([card]);
        session.send(msg);
        session.send("您好～我是TradingBot，除了提供台灣期貨即時動態、每日未平倉資訊，還結合TradingBot自動交易系統的即時交易，並可提供選擇權投資建議，請參考以下選單：");
        session.beginDialog('/help');
    },
    function (session, results) {
        // Display menu
        session.beginDialog('/menu');
    },
    function (session, results) {
        // Always say goodbye
        session.send("再見囉～歡迎來信指教 tradingbot.tw@gmail.com 期待再次使用！");
    }
]);

bot.dialog('/menu', [
    function (session) {
        //carousel 國際新聞 receipt 訂閱服務 alert 到價提示
        builder.Prompts.choice(session, "請選擇下列功能：", "交易現況|選擇權策略|金融新聞|商品資訊|未平倉量|到價警示|問答測驗|訂閱服務|託播廣告|離開");
    },
    function (session, results) {
        if (results.response && results.response.entity != '離開') {
            // Launch demo dialog
            if (results.response.entity === '交易現況') {
                session.beginDialog('/real');
            } else if (results.response.entity === '選擇權策略') {
                session.beginDialog('/options');
            } else if (results.response.entity === '金融新聞') {
                session.beginDialog('/news');
            } else if (results.response.entity === '商品資訊') {
                session.beginDialog('/info');
            } else if (results.response.entity === '未平倉量') {
                session.beginDialog('/oi');
            } else if (results.response.entity === '到價警示') {
                session.beginDialog('/alert');
            } else if (results.response.entity === '問答測驗') {
                session.beginDialog('/knowledge');
            } else if (results.response.entity === '訂閱服務') {
                session.beginDialog('/subscribe');
            } else if (results.response.entity === '託播廣告') {
                session.beginDialog('/ad');
            } else {
                session.beginDialog('/news');
            }
        } else {
            // Exit the menu
            session.endDialog();
        }
    },
    function (session, results) {
        // The menu runs a loop until the user chooses to (quit).
        session.replaceDialog('/menu');
    }
]).reloadAction('reloadMenu', null, { matches: [/^menu|show menu/i, /\u9078\u55AE/] });

bot.dialog('/help', [
    function (session) {
        session.endDialog("下面指令隨時都可輸入：\n\n* menu - 跳出後回到選單。\n* goodbye - 離開這次交談。\n* help - 顯示求助說明。");
    }
]);

bot.dialog('/prompts', [
    function (session) {
        session.send("Our Bot Builder SDK has a rich set of built-in prompts that simplify asking the user a series of questions. This demo will walk you through using each prompt. Just follow the prompts and you can quit at any time by saying 'cancel'.");
        builder.Prompts.text(session, "Prompts.text()\n\nEnter some text and I'll say it back.");
    },
    function (session, results) {
        session.send("You entered '%s'", results.response);
        builder.Prompts.number(session, "Prompts.number()\n\nNow enter a number.");
    },
    function (session, results) {
        session.send("You entered '%s'", results.response);
        session.send("Bot Builder includes a rich choice() prompt that lets you offer a user a list choices to pick from. On Facebook these choices by default surface using Quick Replies if there are 10 or less choices. If there are more than 10 choices a numbered list will be used but you can specify the exact type of list to show using the ListStyle property.");
        builder.Prompts.choice(session, "Prompts.choice()\n\nChoose a list style (the default is auto.)", "auto|inline|list|button|none");
    },
    function (session, results) {
        var style = builder.ListStyle[results.response.entity];
        builder.Prompts.choice(session, "Prompts.choice()\n\nNow pick an option.", "option A|option B|option C", { listStyle: style });
    },
    function (session, results) {
        session.send("You chose '%s'", results.response.entity);
        builder.Prompts.confirm(session, "Prompts.confirm()\n\nSimple yes/no questions are possible. Answer yes or no now.");
    },
    function (session, results) {
        session.send("You chose '%s'", results.response ? 'yes' : 'no');
        builder.Prompts.time(session, "Prompts.time()\n\nThe framework can recognize a range of times expressed as natural language. Enter a time like 'Monday at 7am' and I'll show you the JSON we return.");
    },
    function (session, results) {
        session.send("Recognized Entity: %s", JSON.stringify(results.response));
        builder.Prompts.attachment(session, "Prompts.attachment()\n\nYour bot can wait on the user to upload an image or video. Send me an image and I'll send it back to you.");
    },
    function (session, results) {
        var msg = new builder.Message(session)
            .ntext("I got %d attachment.", "I got %d attachments.", results.response.length);
        results.response.forEach(function (attachment) {
            msg.addAttachment(attachment);
        });
        session.endDialog(msg);
    }
]);

bot.dialog('/real', [
    function (session) {
        session.send("今日程式交易自動交易紀錄如下：");
        redisGetREAL("REAL", session)
    }
]);

bot.dialog('/oi', [
    function (session) {
        session.send("今日未平倉資訊如下：");
        redisGetOI("OI", session)
    }
]);

bot.dialog('/alert', [
    function (session) {
        session.send("透過交談方式選擇金融商品，再設定警示條件，如漲跌幅、價格、交易量，符合即可自動通知。");
        session.endDialog("即將推出，敬請期待......");
    }
]);

bot.dialog('/ad', [
    function (session) {
        session.send("歡迎金融業者託播相關商品廣告，並歡迎異業合作，篩選後提供符合粉絲團朋友之相關商品，創造雙贏機會。");
        session.endDialog("即將推出，敬請期待......");
    }
]);

bot.dialog('/cards', [
    function (session) {
        session.send("You can use either a Hero or a Thumbnail card to send the user visually rich information. On Facebook both will be rendered using the same Generic Template...");

        var msg = new builder.Message(session)
            .attachments([
                new builder.HeroCard(session)
                    .title("Hero Card")
                    .subtitle("The Space Needle is an observation tower in Seattle, Washington, a landmark of the Pacific Northwest, and an icon of Seattle.")
                    .images([
                        builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Seattlenighttimequeenanne.jpg/320px-Seattlenighttimequeenanne.jpg")
                    ])
                    .tap(builder.CardAction.openUrl(session, "https://en.wikipedia.org/wiki/Space_Needle"))
            ]);
        session.send(msg);

        msg = new builder.Message(session)
            .attachments([
                new builder.ThumbnailCard(session)
                    .title("Thumbnail Card")
                    .subtitle("Pike Place Market is a public market overlooking the Elliott Bay waterfront in Seattle, Washington, United States.")
                    .images([
                        builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/PikePlaceMarket.jpg/320px-PikePlaceMarket.jpg")
                    ])
                    .tap(builder.CardAction.openUrl(session, "https://en.wikipedia.org/wiki/Pike_Place_Market"))
            ]);
        session.endDialog(msg);
    }
]);

bot.dialog('/options', [
    function (session) {
        session.send("依據期貨波動和演算法分析，選擇權投資建議如下：");
        redisGetOptions('OPTIONS', session)
        /*var msg = new builder.Message(session)
            .attachments([
                new builder.HeroCard(session)
                    .title("Space Needle")
                    .subtitle("The Space Needle is an observation tower in Seattle, Washington, a landmark of the Pacific Northwest, and an icon of Seattle.")
                    .images([
                        builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Seattlenighttimequeenanne.jpg/320px-Seattlenighttimequeenanne.jpg")
                    ]),
                new builder.HeroCard(session)
                    .title("Pikes Place Market")
                    .subtitle("Pike Place Market is a public market overlooking the Elliott Bay waterfront in Seattle, Washington, United States.")
                    .images([
                        builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/PikePlaceMarket.jpg/320px-PikePlaceMarket.jpg")
                    ])
            ]);
        session.endDialog(msg);*/
    }
]);

bot.dialog('/news', [
    function (session) {
        session.send("您可以選擇喜歡的財經新聞，並按下「讚+1」按鈕，以便篩選更優質的新聞，謝謝！");

        // Ask the user to select an item from a carousel.
        var msg = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                    .title("msn 財經")
                    .subtitle("史上最無感的萬點 股民只開心1秒鐘")
                    .images([
                        builder.CardImage.create(session, "https://cloud.githubusercontent.com/assets/664465/25881551/2f0f5d30-3570-11e7-83f2-d6c8125f8bd8.jpg")
                            .tap(builder.CardAction.showImage(session, "https://cloud.githubusercontent.com/assets/664465/25881549/2ee071aa-3570-11e7-8b76-21982b4c9028.jpg")),
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, "https://www.msn.com/zh-tw/money/topstories/%E5%8F%B2%E4%B8%8A%E6%9C%80%E7%84%A1%E6%84%9F%E7%9A%84%E8%90%AC%E9%BB%9E-%E8%82%A1%E6%B0%91%E5%8F%AA%E9%96%8B%E5%BF%831%E7%A7%92%E9%90%98/ar-BBAWdOL", "MSN財經"),
                        builder.CardAction.imBack(session, "select:msn", "讚+1")
                    ]),
                new builder.HeroCard(session)
                    .title("鉅亨網")
                    .subtitle("當沖降稅藥方失效？財長認量能未發揮")
                    .images([
                        builder.CardImage.create(session, "https://cloud.githubusercontent.com/assets/664465/25882012/f316c6f8-3572-11e7-9cb3-a19b9216a759.jpg")
                            .tap(builder.CardAction.showImage(session, "https://cloud.githubusercontent.com/assets/664465/25882011/f2c32124-3572-11e7-9b59-eaa9067f20c5.jpg"))
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, "http://news.cnyes.com/news/id/3806387", "鉅亨網"),
                        builder.CardAction.imBack(session, "select:cnyes", "讚+1")
                    ]),
                new builder.HeroCard(session)
                    .title("Yahoo!奇摩新聞")
                    .subtitle("台股萬點沒坐穩 收盤翻黑")
                    .images([
                        builder.CardImage.create(session, "https://cloud.githubusercontent.com/assets/664465/25314342/ad9d1b14-2874-11e7-973c-b1f000599f19.png")
                            .tap(builder.CardAction.showImage(session, "https://cloud.githubusercontent.com/assets/664465/25314340/acc8cb48-2874-11e7-90cd-b947739ee75f.png"))
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, "https://tw.news.yahoo.com/%E5%8F%B0%E8%82%A1%E8%90%AC%E9%BB%9E%E6%B2%92%E5%9D%90%E7%A9%A9-%E6%94%B6%E7%9B%A4%E7%BF%BB%E9%BB%91-215311218--finance.html", "Yahoo!奇摩新聞"),
                        builder.CardAction.imBack(session, "select:yahoo", "讚+1")
                    ]),
                new builder.HeroCard(session)
                    .title("信傳媒")
                    .subtitle("號子空蕩蕩 台灣投資人都得了萬點恐懼症")
                    .images([
                        builder.CardImage.create(session, "https://cloud.githubusercontent.com/assets/664465/25881927/5b174012-3572-11e7-9854-1e2a3acd433b.jpg")
                            .tap(builder.CardAction.showImage(session, "https://cloud.githubusercontent.com/assets/664465/25881930/5bc3f406-3572-11e7-815a-78ba28b189ee.jpg"))
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, "https://www.cmmedia.com.tw/home/articles/3789", "信傳媒"),
                        builder.CardAction.imBack(session, "select:cmm", "讚+1")
                    ])
            ]);
        builder.Prompts.choice(session, msg, "select:msn|select:cnyes|select:yahoo|select:cmm");
    },
    function (session, results) {
        var action, item;
        var kvPair = results.response.entity.split(':');
        switch (kvPair[0]) {
            case 'select':
                action = '很讚！';
                break;
        }
        switch (kvPair[1]) {
            case 'msn':
                item = "史上最無感的萬點 股民只開心1秒鐘";
                break;
            case 'cnyes':
                item = "當沖降稅藥方失效？財長認量能未發揮";
                break;
            case 'yahoo':
                item = "台股萬點沒坐穩 收盤翻黑";
                break;
            case 'cmm':
                item = "號子空蕩蕩 台灣投資人都得了萬點恐懼症";
                break;
        }
        session.endDialog('您認為 "%s" %s', item, action);
    }
]);

bot.dialog('/subscribe', [
    function (session) {
        session.send("您可以付費取得TradingBot自動交易系統的即時推播資訊，可供參考並審視您期貨投資的進出點，TradingBot交易紀錄僅供參考，並不承擔您交易上的損失，相關問題請見免責聲明。");
        var msg = new builder.Message(session)
            .attachments([
                new builder.ReceiptCard(session)
                    .title("投資推播訂閱服務")
                    .items([
                        builder.ReceiptItem.create(session, "$94.05", "訂閱服務費").image(builder.CardImage.create(session, "https://cloud.githubusercontent.com/assets/664465/25315599/367e0460-288a-11e7-9fb4-ef0380bd8a88.jpg")),
                    ])
                    .facts([
                        builder.Fact.create(session, "1234567890", "訂單編號"),
                        builder.Fact.create(session, "VISA 1234 4567 7890", "付費方式")
                    ])
                    .tax("NT$4.95")
                    .total("NT$99")
            ]);
        //session.send(msg);

        /*session.send("Or using facebooks native attachment schema...");
        msg = new builder.Message(session)
            .sourceEvent({
                facebook: {
                    attachment: {
                        type: "template",
                        payload: {
                            template_type: "receipt",
                            recipient_name: "Stephane Crozatier",
                            order_number: "12345678902",
                            currency: "USD",
                            payment_method: "Visa 2345",
                            order_url: "http://petersapparel.parseapp.com/order?order_id=123456",
                            timestamp: "1428444852",
                            elements: [
                                {
                                    title: "Classic White T-Shirt",
                                    subtitle: "100% Soft and Luxurious Cotton",
                                    quantity: 2,
                                    price: 50,
                                    currency: "USD",
                                    image_url: "http://petersapparel.parseapp.com/img/whiteshirt.png"
                                },
                                {
                                    title: "Classic Gray T-Shirt",
                                    subtitle: "100% Soft and Luxurious Cotton",
                                    quantity: 1,
                                    price: 25,
                                    currency: "USD",
                                    image_url: "http://petersapparel.parseapp.com/img/grayshirt.png"
                                }
                            ],
                            address: {
                                street_1: "1 Hacker Way",
                                street_2: "",
                                city: "Menlo Park",
                                postal_code: "94025",
                                state: "CA",
                                country: "US"
                            },
                            summary: {
                                subtotal: 75.00,
                                shipping_cost: 4.95,
                                total_tax: 6.19,
                                total_cost: 56.14
                            },
                            adjustments: [
                                { name: "New Customer Discount", amount: 20 },
                                { name: "$10 Off Coupon", amount: 10 }
                            ]
                        }
                    }
                }
            });*/
        session.endDialog(msg);
    }
]);

bot.dialog('/actions', [
    function (session) {
        session.send("Bots can register global actions, like the 'help' & 'goodbye' actions, that can respond to user input at any time. You can even bind actions to buttons on a card.");

        var msg = new builder.Message(session)
            .attachments([
                new builder.HeroCard(session)
                    .title("Space Needle")
                    .subtitle("The Space Needle is an observation tower in Seattle, Washington, a landmark of the Pacific Northwest, and an icon of Seattle.")
                    .images([
                        builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Seattlenighttimequeenanne.jpg/320px-Seattlenighttimequeenanne.jpg")
                    ])
                    .buttons([
                        builder.CardAction.dialogAction(session, "weather", "Seattle, WA", "Current Weather")
                    ])
            ]);
        session.send(msg);

        session.endDialog("The 'Current Weather' button on the card above can be pressed at any time regardless of where the user is in the conversation with the bot. The bot can even show the weather after the conversation has ended.");
    }
]);

// Create a dialog and bind it to a global action
bot.dialog('/weather', [
    function (session, args) {
        session.endDialog("The weather in %s is 71 degrees and raining.", args.data);
    }
]);
bot.beginDialogAction('weather', '/weather');   // <-- no 'matches' option means this can only be triggered by a button.

bot.dialog('/info', [
    function (session) {
        builder.Prompts.choice(session, '請問想查看哪種商品資訊？', SelOpts, {
            maxRetries: 3
        });
    },
    function (session, results) {
        var option = results.response ? results.response.entity : Futures;
        switch (option) {
            case Futures:
                return redisGetSymbol('SYMBOL', session);
            //var url = 'http://info512.taifex.com.tw/Future/chart.aspx?type=1&size=630400&contract=' + redisGet("SYMBOL") + '&CommodityName=%E8%87%BA%E6%8C%87%E9%81%B8';
            //return sendInternetUrl(session, url, 'image/gif', '期貨交易資訊');
            case Options:
                return redisGetSymbol1('SYMBOL', session);
            //return uploadFileAndSend(session, './images/big-image.png', 'image/png', 'BotFramework.png');
            case Woptions:
                return redisGetSymbol1W('SYMBOLW', session);
            /*remotepng.shotpng('https://tw.screener.finance.yahoo.net/future/aa03?opmr=optionpart&opcm=WTXO&opym=' + yyyymm , 'options.png' ).then(function () {
                    sendInline(session, './images/options.png', 'image/png', '選擇權報價');
            });*/
        }
    }]);

var DialogLabels = {
    YES: '是',
    NO: '否'
};

var score;
bot.dialog('/knowledge', [
    function (session) {
        session.send("金融常識問答測驗可驗證是否具備金融投資上的正確觀念，避免因觀念上的錯誤導致錯誤的投資，白白浪費冤枉錢。若要中斷測驗，可輸入menu或選單。");
        score = 0;
        // prompt for search option
        builder.Prompts.choice(
            session,
            '期貨和選擇權，可以跟股票一樣長久持有，並且有股利股息？',
            [DialogLabels.YES, DialogLabels.NO],
            {
                maxRetries: 1,
                retryPrompt: '非所提供的選項'
            });
    },
    function (session, result) {
        if (!result.response) {
            // exhausted attemps and no selection, start over
            session.send('很可惜！輸入錯誤太多次了。 :( 但別難過，您仍然可以重新嘗試，歡迎再度測驗！');
            return session.endDialog();
        }

        // on error, start over
        session.on('error', function (err) {
            session.send('輸入錯誤選項： %s ，中斷此測驗。', err.message);
            session.endDialog();
        });

        // continue on proper dialog
        var selection = result.response.entity;
        switch (selection) {
            case DialogLabels.YES:
                session.send('答錯了！ :( 請去研讀相關金融商品說明。');
                return session.beginDialog('/knowledge1');
            case DialogLabels.NO:
                score = score + 20;
                session.send('答對了！期貨選擇權在契約到期後，就會自動中止並履約，因此不會有股利股息。');
                return session.beginDialog('/knowledge1');
        };
    }
]);

var DialogLabels1 = {
    A50: '50',
    A100: '100',
    A150: '150',
    A200: '200'
};

bot.dialog('/knowledge1', [
    function (session) {
        builder.Prompts.choice(
            session,
            '請問臺股指數期貨（大台）的契約指數1點是新台幣多少元？',
            [DialogLabels1.A50, DialogLabels1.A100, DialogLabels1.A150, DialogLabels1.A200],
            {
                maxRetries: 1,
                retryPrompt: '非所提供的選項'
            });
    },
    function (session, result) {
        if (!result.response) {
            // exhausted attemps and no selection, start over
            session.send('很可惜！輸入錯誤太多次了。 :( 但別難過，您仍然可以重新嘗試，歡迎再度測驗！');
            return session.endDialog();
        }

        // on error, start over
        session.on('error', function (err) {
            session.send('輸入錯誤選項： %s ，中斷此測驗。', err.message);
            session.endDialog();
        });

        // continue on proper dialog
        var selection = result.response.entity;
        switch (selection) {
            case DialogLabels1.A50:
                session.send('答錯了！ :( 請去研讀相關金融商品說明。');
                return session.beginDialog('/knowledge2');
            case DialogLabels1.A100:
                session.send('答錯了！ :( 請去研讀相關金融商品說明。');
                return session.beginDialog('/knowledge2');
            case DialogLabels1.A150:
                session.send('答錯了！ :( 請去研讀相關金融商品說明。');
                return session.beginDialog('/knowledge2');
            case DialogLabels1.A200:
                score = score + 20;
                session.send('答對了！臺指期每跳動1點，就表示變動200元，跳動20點，就是2000元。');
                return session.beginDialog('/knowledge2');
        }
    }
]);

var DialogLabels2 = {
    A1: '每個月的1號',
    A2: '每個月的第三個星期三',
    A3: '每個月的倒數第二個日',
    A4: '每個月的最後一天'
};

bot.dialog('/knowledge2', [
    function (session) {
        builder.Prompts.choice(
            session,
            '請問臺股指數期貨選擇權相關商品，例如臺指期貨、小型臺指期貨和臺指選擇權的契約是何時到期並履約結算？',
            [DialogLabels2.A1, DialogLabels2.A2, DialogLabels2.A3, DialogLabels2.A4],
            {
                maxRetries: 1,
                retryPrompt: '非所提供的選項'
            });
    },
    function (session, result) {
        if (!result.response) {
            // exhausted attemps and no selection, start over
            session.send('很可惜！輸入錯誤太多次了。 :( 但別難過，您仍然可以重新嘗試，歡迎再度測驗！');
            return session.endDialog();
        }

        // on error, start over
        session.on('error', function (err) {
            session.send('輸入錯誤選項： %s ，中斷此測驗。', err.message);
            session.endDialog();
        });

        // continue on proper dialog
        var selection = result.response.entity;
        switch (selection) {
            case DialogLabels2.A1:
                session.send('答錯了！ :( 請去研讀相關金融商品說明。');
                return session.beginDialog('/knowledge3');
            case DialogLabels2.A2:
                score = score + 20;
                session.send('答對了！是每個月的第三個星期三，遇假日順延一天。');
                return session.beginDialog('/knowledge3');
            case DialogLabels2.A3:
                session.send('答錯了！ :( 請去研讀相關金融商品說明。');
                return session.beginDialog('/knowledge3');
            case DialogLabels2.A4:
                session.send('答錯了！ :( 請去研讀相關金融商品說明。');
                return session.beginDialog('/knowledge3');
        }
    }
]);

var DialogLabels3 = {
    B1: '個股期貨',
    B2: '個股權證',
    B3: '黃金期貨',
    B4: '個股選擇權'
};

bot.dialog('/knowledge3', [
    function (session) {
        builder.Prompts.choice(
            session,
            '期貨是現貨股票交易的避險工具，而選擇權又是期貨的避免工具，請問單一個股的避免工具為何？',
            [DialogLabels3.B1, DialogLabels3.B2, DialogLabels3.B3, DialogLabels3.B4],
            {
                maxRetries: 1,
                retryPrompt: '非所提供的選項'
            });
    },
    function (session, result) {
        if (!result.response) {
            // exhausted attemps and no selection, start over
            session.send('很可惜！輸入錯誤太多次了。 :( 但別難過，您仍然可以重新嘗試，歡迎再度測驗！');
            return session.endDialog();
        }

        // on error, start over
        session.on('error', function (err) {
            session.send('輸入錯誤選項： %s ，中斷此測驗。', err.message);
            session.endDialog();
        });

        // continue on proper dialog
        var selection = result.response.entity;
        switch (selection) {
            case DialogLabels3.B1:
                score = score + 20;
                session.send('答對了！透過個股期貨買進或放空才能直接對單一股票進行避險。');
                return session.beginDialog('/knowledge4');
            case DialogLabels3.B2:
                session.send('答錯了！ :( 請去研讀相關金融商品說明。');
                return session.beginDialog('/knowledge4');
            case DialogLabels3.B3:
                session.send('答錯了！ :( 請去研讀相關金融商品說明。');
                return session.beginDialog('/knowledge4');
            case DialogLabels3.B4:
                session.send('答錯了！ :( 請去研讀相關金融商品說明。');
                return session.beginDialog('/knowledge4');
        }
    }
]);

var DialogLabels4 = {
    C1: '股票價格',
    C2: '權證價格',
    C3: '股票交易量',
    C4: '權證交易量'
};

bot.dialog('/knowledge4', [
    function (session) {
        builder.Prompts.choice(
            session,
            '上一題提到個股權證，而權證又分為認購跟認售，分別為買漲與買跌，券商發行權證是將持有股票包裝成權證商品再賣給投資大眾，請問券商是控制那一項來讓公司獲利？',
            [DialogLabels4.C1, DialogLabels4.C2, DialogLabels4.C3, DialogLabels4.C4],
            {
                maxRetries: 1,
                retryPrompt: '非所提供的選項'
            });
    },
    function (session, result) {
        if (!result.response) {
            // exhausted attemps and no selection, start over
            session.send('很可惜！輸入錯誤太多次了。 :( 但別難過，您仍然可以重新嘗試，歡迎再度測驗！');
            return session.endDialog();
        }

        // on error, start over
        session.on('error', function (err) {
            session.send('輸入錯誤選項： %s ，中斷此測驗。', err.message);
            session.endDialog();
        });

        // continue on proper dialog
        var selection = result.response.entity;
        switch (selection) {
            case DialogLabels4.C1:
                session.send('答錯了！ :( 請去研讀相關金融商品說明。');
                return session.endDialog('您的成績為： %s 再接再厲！', score);
            case DialogLabels4.C2:
                session.send('答錯了！ :( 請去研讀相關金融商品說明。');
                return session.endDialog('您的成績為： %s 再接再厲！', score);
            case DialogLabels4.C3:
                session.send('答錯了！ :( 請去研讀相關金融商品說明。');
                return session.endDialog('您的成績為： %s 再接再厲！', score);
            case DialogLabels4.C4:
                score = score + 20;
                var score_txt = '再接再厲！';
                if (score === 100) {
                    score_txt = '真是天才！';
                }
                session.send('答對了！透過操控個股權證的流動率，當散戶賺錢時，權證交易量降低，就可減少虧損，而當散戶賠錢時，權證交易量提高，就可增加獲利。');
                return session.endDialog('您的成績為： %s ' + score_txt, score);
        }
    }
]);

var Futures = '期貨走勢';
var Woptions = '周選擇權價格表';
var Options = '選擇權價格表';
var SelOpts = [Futures, Options, Woptions];

// Sends attachment inline in base64
function sendInline(session, filePath, contentType, attachmentFileName) {
    fs.readFile(filePath, function (err, data) {
        if (err) {
            return session.send('Oops. Error reading file.');
        }

        var base64 = Buffer.from(data).toString('base64');

        var msg = new builder.Message(session)
            .addAttachment({
                contentUrl: util.format('data:%s;base64,%s', contentType, base64),
                contentType: contentType,
                name: attachmentFileName
            });

        //session.send(msg);
        session.endDialog(msg);
    });
}

// Uploads a file using the Connector API and sends attachment
function uploadFileAndSend(session, filePath, contentType, attachmentFileName) {

    // read file content and upload
    fs.readFile(filePath, function (err, data) {
        if (err) {
            return session.send('Oops. Error reading file.');
        }

        // Upload file data using helper function
        uploadAttachment(
            data,
            contentType,
            attachmentFileName,
            connector,
            connectorApiClient,
            session.message.address.serviceUrl,
            session.message.address.conversation.id)
            .then(function (attachmentUrl) {
                // Send Message with Attachment obj using returned Url
                var msg = new builder.Message(session)
                    .addAttachment({
                        contentUrl: attachmentUrl,
                        contentType: contentType,
                        name: attachmentFileName
                    });

                session.send(msg);
            })
            .catch(function (err) {
                console.log('Error uploading file', err);
                session.send('Oops. Error uploading file. ' + err.message);
            });
    });
}

// Sends attachment using an Internet url
function sendInternetUrl(session, url, contentType, attachmentFileName) {
    var msg = new builder.Message(session)
        .addAttachment({
            contentUrl: url,
            contentType: contentType,
            name: attachmentFileName
        });

    session.endDialog(msg);
}

// Uploads file to Connector API and returns Attachment URLs
function uploadAttachment(fileData, contentType, fileName, connector, connectorApiClient, baseServiceUrl, conversationId) {

    var base64 = Buffer.from(fileData).toString('base64');

    // Inject the connector's JWT token into to the Swagger client
    function addTokenToClient(connector, clientPromise) {
        // ask the connector for the token. If it expired, a new token will be requested to the API
        var obtainToken = Promise.promisify(connector.addAccessToken.bind(connector));
        var options = {};
        return Promise.all([clientPromise, obtainToken(options)]).then(function (values) {
            var client = values[0];
            var hasToken = !!options.headers.Authorization;
            if (hasToken) {
                var authHeader = options.headers.Authorization;
                client.clientAuthorizations.add('AuthorizationBearer', new Swagger.ApiKeyAuthorization('Authorization', authHeader, 'header'));
            }

            return client;
        });
    }

    // 1. inject the JWT from the connector to the client on every call
    return addTokenToClient(connector, connectorApiClient).then(function (client) {
        // 2. override API client host and schema (https://api.botframework.com) with channel's serviceHost (e.g.: https://slack.botframework.com or http://localhost:NNNN)
        var serviceUrl = url.parse(baseServiceUrl);
        var serviceScheme = serviceUrl.protocol.split(':')[0];
        client.setSchemes([serviceScheme]);
        client.setHost(serviceUrl.host);

        // 3. POST /v3/conversations/{conversationId}/attachments
        var uploadParameters = {
            conversationId: conversationId,
            attachmentUpload: {
                type: contentType,
                name: fileName,
                originalBase64: base64
            }
        };

        return client.Conversations.Conversations_UploadAttachment(uploadParameters)
            .then(function (res) {
                var attachmentId = res.obj.id;
                var attachmentUrl = serviceUrl;

                attachmentUrl.pathname = util.format('/v3/attachments/%s/views/%s', attachmentId, 'original');
                return attachmentUrl.format();
            });
    });
}