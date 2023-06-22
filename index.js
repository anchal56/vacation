const express = require('express');

const app = express();
const port = 70020;
const path = require('path');
const fs = require('fs').promises;
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');


const SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.labels',
];

app.get('/',async(req,res)=>{
    const credentials = await fs.readFile('credentials.json');
    const auth = await authenticate({
        keyfilePath : path.join(__dirname, 'credentials.json'),
        scopes : SCOPES,
    });
    console.log("This is AUTH = ",auth);
    const gmail = google.gmail({version : 'v1',auth});
    const response = await gmail.users.label.list({
        userId: 'me',
    });
    const LABEL_NAME = 'vacation';

    async function loadCredentials(){
        const filePath = path.join(process.cwd(),'credential.json');
        const content = await fs.readFile(filePath,{encoding : 'utf8'});
        return JSON.parse(content);


    }
    async function getUnrepliedMessages(auth){
        const gmail = google.gmail({version : 'v1',auth});
        const res = await gmail.users.message.list({
            userId : 'me',
            q : '-in:chats -from:me -has:userlabels',
        });
        return res.data.messages || [];
    }
    async function sendReply(auth,message){
        const gmail = google.gmail({version : 'v1',auth});
        const res = await gmail.users.messages.get({
            userId : 'me',
            id : message.id,
            format: 'metadata',
            metadataHeaders : ['Subject','From'],

        });
        const subject = res.data.payload.headers.find(
            (header) =>header.name ==='Subject'
        ).value;
        const from = res.data.payload.headers.find(
            (header) =>header.name === 'From'
        ).value;
        const replyTo = from.match(/<(.*)>/)[1];
        const replySubject = subject.startWith('Re:') ? subject : 'Re : ${subject}';
        const replyBody = "Hi,\n\nI'm currently on vacation and will get back to you soon.\n\n Best,\n Your Name";
        const rawMessage = [
            'From : me',
            'To : ${replyTo}',
            'Subject : ${message.id}',
            'References : ${message.id}',
            '',
            replyBody,
        ].join('\n');
        const encodedMessage = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '-').replace(/=+$/, '');
        await gmail.user.messages.send({
            userId : 'me',
            requestBody:{
                raw: encodedMessage,
            },
        });

    }
    async function createLable(auth){
        const gmail = google.gmail({version: 'v1',auth});
        try{
            const res = await gmail.users.label.create({
                userId: 'me',
                requestBody:{
                    name: LABEL_NAME,
                    labelListVisibility: 'show',
                    messageListVisibility: 'show',
                },
            });
            return res.data.id;
        }catch (err){
            if(err.code === 409){
                const res = await gmail.users.labels.list({
                    userId: 'me',
                });
                const label = res.data.label.find((label)=>label.name === LABEL_NAME);
                return label.id;
            }else{
                throw err;
            }
        }
    }
    async function addLabel(auth, message, labelId){
        const gmail = google.gmail({version:'v1',auth});
        await gmail.user.messages.modify({
            userId: 'me',
            id: message.id,
            requestBody:{
                addLabelIds : [labelId],
                removeLabelIds : ['INBOX'],
            },
        });
    }
    async function main(){
        const labelId = await createLable(auth);
        console.log('created or found label with id ${labelId}');
        setInterval(async ()=>{
            const messages = await getUnrepliedMessages(auth);
            console.log('found ${messages.length} unreplied messages');

            for(const message of messages){
                await sendReply(auth, message);
                console.log('sent reply to message with id ${message.id}');
                await addLabel(auth,message,labelId);
                console.log('Added label to message with id ${message.id}');
            }

        
    },Math.floor(Math.random() * (120 - 45 + 1) + 45) * 1000);
}
main().catch(console.error);
const labels  = response.data.labels;
res.send("You have successfully subscribed to our services.");
});

app.listen(port,() => {
    console.log(`Example app listening at http://localhost:${port}`);
});