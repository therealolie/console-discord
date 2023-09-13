/*const __DEBUG = true;
//*/const __DEBUG = false;

const fs = require('fs');
const { Client, Events, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: 4194303 });
const {min, max, floor, ceil} = Math;
const stdin = process.stdin;
stdin.resume();
stdin.setEncoding('utf8');

const print = (prin) => {
	if(prin!==undefined) process.stdout.write(prin);
}
const input = (prin) => {
	print(prin)
	return new Promise(res => stdin.on('data',res));
}
const data = {
	cur_guild:0,
	guild_amt:0,
	cur_sel:'guild',
	cur_message:0,
	cur_thing:null,
	cur_guild_obj:null,
	guilds:{},
	channels:{},
	cur_channel_obj:null,
	cur_message_obj:null,
	emojis:require('./emojis.json'),
};
let frame = 0;
async function render(){
	let curframe = frame;
	frame += 1;
	let out = [];
	//server/channel list
	let logs = [];
	{
		out.push([])
		let guilds = await client.guilds.cache.map(guild => guild);
		data.guild_amt = guilds.length;
		out[0].push(client.user.username)
		for(let i in guilds){
			let guild = guilds[i]
			out[0].push((i!=guilds.length-1?'├':'└')+(i==data.cur_guild?data.cur_sel=='guild'?"\033[30;107m":"\033[30;47m":"")+guild.name+"\033[0m");
			if(i==data.cur_guild && data.cur_sel=='guild')
				data.cur_thing = guild;
			if(i==data.cur_guild){
				data.cur_guild_obj = guild;
			}
			if(data.guilds[i]?.open){
				let channels = await guild.channels.cache.map(c=>c);
				data.guilds[i].chan_amt = channels.length;
				for(let j in channels){
					if(i==data.cur_guild)
						data.chan_amt = channels.length;
					let chan = channels[j];
					let text = i!=guilds.length-1?"│ ":"  ";
					out[0].push(text + (j!=channels.length-1?'├':'└') + (j==data.guilds[i].cur_chan?data.cur_sel=='channel'&&data.cur_guild==i?"\033[30;107m":"\033[30;47m":"") +chan.name + "\033[0m");
					if(j==data.guilds[i].cur_chan && data.cur_sel=='channel' && data.cur_guild==i)
						data.cur_thing = chan;
					if(j==data.guilds[i].cur_chan && data.cur_guild==i)
						data.cur_channel_obj = chan;
				}
			}
		}
	}
	
	//messages
	{
		out.push([])
		if(data.cur_sel=='channel'||data.cur_sel=='message'){
			let chan = data.cur_channel_obj;
			if([0,1,11,12].includes(chan.type)&&chan.viewable){
				if(!(chan.id in data.channels)){
					let msgs = await chan.messages.fetch({limit: 10});
				data.channels[chan.id] = {msgs:[]};
					for(let a of msgs){
						data.channels[chan.id].msgs.unshift(a[1]);
					}
				}
				let msgs = data.channels[chan.id].msgs;
				let last = "0";
				for(let a in msgs){
					let prefix = "\033[0m"
					if(data.cur_sel=='message'&&a==data.cur_message){
						prefix = "\033[30;107m";
						data.cur_message_obj = msgs[a];
						data.cur_thing = msgs[a];
					}
					let msg = msgs[a];
					if(last!=msg.author.id){
						let temp = prefix+msg.author.username+"\033[0m";
						if(msg.type==19){
							let reply = await msg.fetchReference();
							temp += " → " + reply.author.username + " → " + reply.content.slice(0,50).replaceAll('\n','  ');
						}
						out[1].push(temp)
					}
					last = msg.author.id;
					let cont = msg.content;
					if('embeds' in msg){
						cont += "\n";
						for(let embed of msg.embeds){
							cont += embed.data.title;
							cont += embed.data.description;
						}
					}
					do{
						let line = cont.slice(0,100).split(/[\n\r]/)[0];
						out[1].push(prefix + "     " + line.replaceAll('\033','^[')+"\033[0m")
						cont = cont.slice(line.length);
						while(cont[0]=='\n'||cont[0]=='\r')
							cont=cont.slice(1);
					}while(cont.length>0);
					let emojis = Array.from(msg.reactions.cache);
					let temp = "";
					for(let a of emojis)
						temp += (a[0].length<5?a[0]:'?').repeat(a[1].count);
					if(temp) out[1].push("     \033[100m "+temp+" \033[0m")
					if(__DEBUG)logs.push(msg)
				}
			}
			else if(chan.viewable==false){
				out[1].push('Hidden!')
			}
		}
	}

	let lines = 0;
	for(let a of out)
		lines = max(lines,a.length)
	let lens = [];
	for(let a in out){
		lens.push(0)
		for(let b of out[a])
			lens[a] = max(lens[a],b.replaceAll(new RegExp("\033\[[0-9;]*?m","g"),'').length)
	}
	if(frame-1!=curframe) return;
	print('\n\n\n\n\n\n\n\n\n\n\033[2J')
	for(let a=0;a<lines;a++){
		for(let b in out){
			let text = out[b][a-lines+out[b].length]??"";
			let len = text.replaceAll(new RegExp("\033\[[0-9;]*?m","g"),'').length;
			print(text+" ".repeat(lens[b]-len+5))
		}
		print("\n")
	}
	if(__DEBUG){
		console.log(data);
		for(let a in data.channels)
			console.log(data.channels[a])
		for(let a of logs)console.log(a)
	}
}

(async ()=>{
	{
		let TOKEN = (await input('TOKEN: ')).slice(0,-1);
		if(TOKEN=="") TOKEN = (""+fs.readFileSync('../token.txt')).trim();
		let pro = new Promise(res => client.on('ready',res))
		client.login(TOKEN)
		await pro;
		client.on('messageCreate',(msg)=>{
			if(msg.channel.id in data.channels){
				data.channels[msg.channel.id].msgs.push(msg);
			}
			render();
		})
	}
	let rend = true;
	while(true){
		if(rend)
			render();
		rend = true;
		stdin.setRawMode(true);
		let key = await input();
		if(key=='q'||key=='\u0003')
			process.exit()
		else if(key[0]=='\u001b'){
			if(key[2]=='A'){
				if(data.cur_sel=='guild') data.cur_guild=max(0,data.cur_guild-1);
				if(data.cur_sel=='channel') data.guilds[data.cur_guild].cur_chan=max(0,data.guilds[data.cur_guild].cur_chan-1);
				if(data.cur_sel=='message') data.cur_message=max(data.cur_message-1,0)
			}
			if(key[2]=='B'){
				if(data.cur_sel=='guild') data.cur_guild=min(data.cur_guild+1,data.guild_amt-1);
				if(data.cur_sel=='channel') data.guilds[data.cur_guild].cur_chan=min(data.guilds[data.cur_guild].cur_chan+1,data.guilds[data.cur_guild].chan_amt-1);
				if(data.cur_sel=='message') data.cur_message=min(data.cur_message+1,data.channels[data.cur_channel_obj.id].msgs.length-1);
			}
			if(key[2]=='C'){
				if(data.cur_sel=='channel'&&[0,1,11,12].includes(data.cur_channel_obj.type)&&data.cur_channel_obj.viewable){
					data.cur_message = data.channels[data.cur_channel_obj.id].msgs.length-1;
					data.cur_sel='message';
				}
				if(data.cur_sel=='guild'){
					data.guilds[data.cur_guild] = data.guilds[data.cur_guild]??{};
					data.guilds[data.cur_guild].open = true;
					data.guilds[data.cur_guild].cur_chan = data.guilds[data.cur_guild].cur_chan??0;
					data.cur_sel='channel';
				}
			}
			if(key[2]=='D'){
				if(data.cur_sel=='guild'){
					delete data.guilds[data.cur_guild]?.open;
				}
				if(data.cur_sel=='channel'){
					data.cur_sel='guild';
				}
				if(data.cur_sel=='message'){
					data.cur_sel='channel';
				}
			}
		}
		else if(key=='\r'){
			if(data.cur_sel=='channel'){
				stdin.setRawMode(false);
				frame+=1;
				print(">>> ")
				let msg = await input();
				if(!msg.includes("\033"))
					data.cur_channel_obj.send(msg).catch(()=>{});
			}
		}
		else if(key=='r'){
			if(data.cur_sel=='message'){
				stdin.setRawMode(false);
				frame+=1;
				print("<<< ")
				let msg = await input();
				if(!msg.includes("\033"))
					data.cur_message_obj.reply(msg).catch(()=>{});
			}
		}
		else if(key==':'){
			stdin.setRawMode(false);
			frame+=1;
			print(':')
			let command = await input();
			if(command=='q\n'){
				process.exit();
				return;
			}
			console.log(eval(command));
			await input();
		}
		else if(key=='+'&&data.cur_sel=='message'){
			stdin.setRawMode(false);
			frame+=1;
			print('+')
			let emote = (await input()).trim();
			if(!emote.includes("\033")){
				try{
					if(emote in data.emojis)
						await data.cur_message_obj.react(data.emojis[emote]);
					else 
						await data.cur_message_obj.react(emote)
				}catch(err){
					console.log('unable to react!')
					await new Promise(res => setTimeout(res,1000)); 
				}
			}
		}
		else{
			if(__DEBUG) console.log(JSON.stringify(key))
			rend = false;
		}
	}
})()
