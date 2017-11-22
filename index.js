import fs from 'fs';
import childProcess from 'child_process';
import { RtmClient, CLIENT_EVENTS, RTM_EVENTS } from '@slack/client';
import stripAnsi from 'strip-ansi';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

var bot_token = fs.readFileSync('API_TOKEN');
var rtm = new RtmClient(bot_token);

let channel = 'C6T4BCTDK'; // #z
// let channel = 'D6SRG00F6'; // @remco DM

const command = 'frotz ./ZORK1.DAT';

console.log('Starting ' + command + '...');

const cmd = childProcess.spawn('frotz', ['./ZORK1.DAT']);

const conj = (result, input) => [...result, input];

const mapping = func => reducer => (result, input) =>
  reducer(result, func(input));

const filtering = func => reducer => (result, input) =>
  func(input) ? reducer(result, input) : result;

const compose = (func, ...funcs) =>
  func ? x => compose(...funcs)(func(x)) : x => x;

const xform = compose(
  filtering(x => x % 2 === 0),
  filtering(x => x < 10),
  mapping(x => x * x),
  mapping(x => x + 1)
);

xform(conj)([], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

const emojis = {
  house: ':house_with_garden:',
  forest: ':evergreen_tree:',
  tree: ':deciduous_tree:',
  mailbox: ':postbox:',
  leaflet: ':scroll:',
  troll: ':japanese_ogre:',
  sword: ':dagger_knife:',
  door: ':door:',
  lantern: ':flashlight:',
  kitchen: ':knife_fork_plate:',
  bottle: ':baby_bottle:',
  food: ':stew:',
  pepper: ':hot_pepper:',
  water: ':droplet:',
  sack: ':pouch:',
  window: ':frame_with_picture:',
  coins: ':moneybag:',
  temple: ':classical_building:'
};

const addEmojis = text =>
  text.replace(
    /\b\w+\b/gi,
    word =>
      word.toLowerCase() in emojis
        ? word + ' ' + emojis[word.toLowerCase()]
        : word
  );

cmd.stdout.on('readable', () => {
  const chunk = cmd.stdout.read();
  if (chunk !== null) {
    let string = chunk.toString('ascii');
    if (string.match('ZORK is a registered trademark of Infocom, Inc.')) {
      return;
    }
    string = string.replace(/\u001B/g, ':');
    //string = stripAnsi(string);
    let lines = string.split('\r');
    lines = lines.filter(l => l.match(/:\[\d\dd.*$/));
    lines = lines.map(l => l.replace(/^.*:\[\d\dd(.*)$/, '$1'));
    lines = lines.map(l => l.replace(/^:\(B:\[m/, ''));
    lines = lines.map(l => l.replace(/:\[\d\d;\dH/g, ' '));
    lines = lines.filter(l => l != '>');
    lines = lines.map(l => (l.length < 70 ? l + '\n' : l + ' '));
    string = lines.join('');
    string = addEmojis(string);
    lines = string.split('\n');
    lines.forEach(async l => {
      await sleep(250 * Math.sqrt(l.length));
      rtm.sendMessage(l, channel);
    });
  }
});

cmd.stderr.on('readable', () => {
  const chunk = cmd.stderr.read();
  if (chunk !== null) {
    console.log(`stderr: ${unansi(chunk)}`);
  }
});

cmd.stdout.on('end', () => {
  console.log('frotz ended');
});

console.log('Connecting Slack...');

// The client will emit an RTM.AUTHENTICATED event on successful connection, with the `rtm.start` payload
rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, rtmStartData => {
  for (const c of rtmStartData.channels) {
    if (c.is_member && c.name === 'general') {
      channel = c.id;
    }
  }
  console.log(
    `Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team
      .name}, but not yet connected to a channel`
  );
});

// you need to wait for the client to fully connect before you can send messages
rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, () => {
  // rtm.sendMessage('Hello!', channel);
  console.log('Conntected!');
});

rtm.on(RTM_EVENTS.MESSAGE, message => {
  console.log('Message:', message); //this is no doubt the lamest possible message handler, but you get the idea

  if (message.channel !== channel) {
    return;
  }
  if (message.type !== 'message' || message.subtype) {
    return;
  }
  let text = message.text;
  if (text.match(/<@[0-9A-Z]{9}>/)) {
    return;
  }
  text = text.split('\n')[0];
  if (text.length == 0 || text.length > 100) {
    return;
  }
  text = text + '\n';
  console.log('COMMAND: ' + text);
  cmd.stdin.write(text);
});

rtm.start();
