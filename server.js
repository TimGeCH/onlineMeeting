const express = require("express");
const path = require("path");
const axios = require('axios');  // 添加这行
const FormData = require('form-data');  // 添加这行
const util = require('util');
var app = express();
var server = app.listen(process.env.PORT || 3000, function () {
    console.log("Listening on port 3000");
});
const fs = require("fs");
const fileUpload = require("express-fileupload");
const io = require("socket.io")(server, {
    allowEIO3: true, // false by default
});
app.use(express.static(path.join(__dirname, "")));
var userConnections = [];
io.on("connection", (socket) => {
    console.log("socket id is ", socket.id);
    socket.on("userconnect", (data) => {
        console.log("userconnent", data.displayName, data.meetingid);
        var other_users = userConnections.filter(
            (p) => p.meeting_id == data.meetingid
        );
        userConnections.push({
            connectionId: socket.id,
            user_id: data.displayName,
            meeting_id: data.meetingid,
        });
        var userCount = userConnections.length;
        console.log(userCount);
        other_users.forEach((v) => {
            socket.to(v.connectionId).emit("inform_others_about_me", {
                other_user_id: data.displayName,
                connId: socket.id,
                userNumber: userCount,
            });
        });
        socket.emit("inform_me_about_other_user", other_users);
    });
    socket.on("SDPProcess", (data) => {
        socket.to(data.to_connid).emit("SDPProcess", {
            message: data.message,
            from_connid: socket.id,
        });
    });
    socket.on("sendMessage", (msg) => {
        console.log(msg);
        var mUser = userConnections.find((p) => p.connectionId == socket.id);
        if (mUser) {
            var meetingid = mUser.meeting_id;
            var from = mUser.user_id;
            var list = userConnections.filter((p) => p.meeting_id == meetingid);
            list.forEach((v) => {
                socket.to(v.connectionId).emit("showChatMessage", {
                    from: from,
                    message: msg,
                });
            });
        }
    });
    socket.on("fileTransferToOther", (msg) => {
        console.log(msg);
        var mUser = userConnections.find((p) => p.connectionId == socket.id);
        if (mUser) {
            var meetingid = mUser.meeting_id;
            var from = mUser.user_id;
            var list = userConnections.filter((p) => p.meeting_id == meetingid);
            list.forEach((v) => {
                socket.to(v.connectionId).emit("showFileMessage", {
                    username: msg.username,
                    meetingid: msg.meetingid,
                    filePath: msg.filePath,
                    fileName: msg.fileName,
                });
            });
        }
    });

    socket.on("disconnect", function () {
        console.log("Disconnected");
        var disUser = userConnections.find((p) => p.connectionId == socket.id);
        if (disUser) {
            var meetingid = disUser.meeting_id;
            userConnections = userConnections.filter(
                (p) => p.connectionId != socket.id
            );
            var list = userConnections.filter((p) => p.meeting_id == meetingid);
            list.forEach((v) => {
                var userNumberAfUserLeave = userConnections.length;
                socket.to(v.connectionId).emit("inform_other_about_disconnected_user", {
                    connId: socket.id,
                    uNumber: userNumberAfUserLeave,
                });
            });
        }
    });

    // <!-- .....................HandRaise .................-->
    socket.on("sendHandRaise", function (data) {
        var senderID = userConnections.find((p) => p.connectionId == socket.id);
        console.log("senderID :", senderID.meeting_id);
        if (senderID.meeting_id) {
            var meetingid = senderID.meeting_id;
            // userConnections = userConnections.filter(
            //   (p) => p.connectionId != socket.id
            // );
            var list = userConnections.filter((p) => p.meeting_id == meetingid);
            list.forEach((v) => {
                var userNumberAfUserLeave = userConnections.length;
                socket.to(v.connectionId).emit("HandRaise_info_for_others", {
                    connId: socket.id,
                    handRaise: data,
                });
            });
        }
    });
    // <!-- .....................HandRaise .................-->
    // 在socket.io连接处理中添加以下内容
    socket.on("transcriptionResult", function(data) {
      var meetingid = data.meetingId;
      var list = userConnections.filter((p) => p.meeting_id == meetingid);
      list.forEach((v) => {
        socket.to(v.connectionId).emit("updateTranscription", {
          text: data.text
        });
      });
    });

    socket.on('audioChunk', async (audioChunk) => {
        try {
            const formData = new FormData();
            formData.append('audio_file', audioChunk, 'audio.webm');

            const response = await axios({
                method: 'post',
                url: 'http://localhost:9000/asr',
                params: {
                    encode: true,
                    task: 'transcribe',
                    word_timestamps: false,
                    output: 'json'
                },
                data: formData,
                headers: {
                    ...formData.getHeaders(),
                    'Content-Type': 'multipart/form-data'
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            socket.emit('transcriptionResult', { text: response.data.text });
        } catch (error) {
            console.error('Error in audio chunk processing:', error);
        }
    });
});

app.use(fileUpload({
    debug: true,
    limits: { fileSize: 50 * 1024 * 1024 }, // 增加文件大小限制到50MB
}));
app.post("/attachimg", function (req, res) {
    var data = req.body;
    var imageFile = req.files.zipfile;
    console.log(imageFile);
    var dir = "public/attachment/" + data.meeting_id + "/";
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    imageFile.mv(
        "public/attachment/" + data.meeting_id + "/" + imageFile.name,
        function (error) {
            if (error) {
                console.log("couldn't upload the image file , error: ", error);
            } else {
                console.log("Image file successfully uploaded");
            }
        }
    );
});

// 添加这个新的路由
app.post('/proxy-asr', async (req, res) => {
    console.log('Received request to /proxy-asr');
    try {
        if (!req.files || Object.keys(req.files).length === 0) {
            console.log('No files were uploaded');
            return res.status(400).send('No files were uploaded.');
        }

        const audioFile = req.files.audio_file;
        console.log('Audio file received:', audioFile.name);

        const formData = new FormData();
        formData.append('audio_file', audioFile.data, audioFile.name);

        console.log('Sending request to Whisper API...');
        const response = await axios({
            method: 'post',
            url: 'http://localhost:9000/asr',
            params: {
                encode: true,
                task: 'transcribe',
                word_timestamps: false,
                output: 'json'
            },
            data: formData,
            headers: {
                ...formData.getHeaders(),
                'Content-Type': 'multipart/form-data'
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        console.log('Received response from Whisper API');

        res.json(response.data);
    } catch (error) {
        console.error('Error in /proxy-asr:', util.inspect(error, { depth: null }));
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
        } else if (error.request) {
            console.error('No response received:', error.request);
        } else {
            console.error('Error setting up request:', error.message);
        }
        res.status(500).send('Server error: ' + error.message);
    }
});
