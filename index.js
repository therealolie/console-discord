const fs = require('fs');
const { Client, Events, GatewayIntentBits } = require('discord.js-selfbot-v13');
const client = new Client({ checkUpdate: false });
const {min, max, floor, ceil} = Math;
process.stdin.resume();
process.stdin.setEncoding('utf8');
const rl = require('readline');
rl.emitKeypressEvents(process.stdin);
const log = console.log;
console.log = (...args) => process.stdout.write(...args);
const input_history = {};
const cur_prompt = {
	backslashing:false,
	active:false,
	curs_pos:0,
	prefix:"",
	text:"",
	history:[],
	go_down:0,
}
const print_prompt = async () => {
	if(!cur_prompt.active) return;
	let temp = cur_prompt.text;
	if(cur_prompt.backslashing)
		temp = temp.slice(0,cur_prompt.curs_pos) + "\033[47;30m\\\033[0m" + temp.slice(cur_prompt.curs_pos);
	temp = temp.replaceAll('\n',"\033[47;30m\\n\033[0m")
	console.log(cur_prompt.prefix+temp)
	if(cur_prompt.text.length!=cur_prompt.curs_pos){
		console.log('\033['+(cur_prompt.text.length-cur_prompt.curs_pos) + 'D')
	}
}
const input = async (args) => {
	const stdin = process.stdin;
	if(typeof args == 'string'){
		return await input({prefix:args});
	}
	if(args?.raw){
		if(args?.print)console.log(args.print)
		stdin.setRawMode(true);
		return await new Promise(res => stdin.once('keypress',(...a)=>res(a[1])));
	}
	cur_prompt.prefix = args?.prefix??"";
	stdin.setRawMode(true);
	let type = 'null';
	if(args?.type)type = args.type;
	cur_prompt.backslashing = false;
	cur_prompt.text = args?.suggest??"";
	cur_prompt.curs_pos = args?.suggest?.length??0;
	cur_prompt.active = true;
	cur_prompt.history = Object.create(input_history[type]??[]);
	console.log(cur_prompt.prefix + cur_prompt.text)
	while(true){
		let cur_inp = await input({raw:true});
		function append(letter){
			cur_prompt.text = cur_prompt.text.slice(0,cur_prompt.curs_pos) + letter + cur_prompt.text.slice(cur_prompt.curs_pos);
			cur_prompt.curs_pos += cur_inp.sequence.length;
		}
		let actions = {
			"\003":()=>process.exit(),
			"\033[D":()=>{
				cur_prompt.curs_pos=max(0,cur_prompt.curs_pos-1);
			},
			"\033[C":()=>{
				cur_prompt.curs_pos=min(cur_prompt.text.length,cur_prompt.curs_pos+1);
			},
			"\033[B":()=>{
				cur_prompt.curs_pos=cur_prompt.text.length;
			},
			"\033[A":()=>{
				cur_prompt.curs_pos=0;
			},
			"\x7F":()=>{
				if(cur_prompt.curs_pos){
					cur_prompt.text = cur_prompt.text.slice(0,cur_prompt.curs_pos-1) + cur_prompt.text.slice(cur_prompt.curs_pos);
					cur_prompt.curs_pos-=1;
				}
			},
			"\\":()=>{
				if(cur_prompt.backslashing){
					cur_prompt.text = cur_prompt.text.slice(0,cur_prompt.curs_pos) + '\\' + cur_prompt.text.slice(cur_prompt.curs_pos);
					cur_prompt.curs_pos += cur_inp.sequence.length;
					cur_prompt.backslashing=false;
				}else
					cur_prompt.backslashing=true;
			},
		}
		let back_actions = {
			"\r":()=>append('\n'),
			"n":()=>append('\n'),
			"\\":()=>append('\\'),
		}
		if(cur_prompt.backslashing && cur_inp.sequence in back_actions){
			back_actions[cur_inp.sequence]();
			cur_prompt.backslashing = false; 
		}else if(cur_inp.sequence=="\r")
			break;
		else if(cur_inp.sequence in actions)
			actions[cur_inp.sequence]();
		else
			append(cur_inp.sequence);
		if(args?.norender) render();
		else{
			console.log("\r\033[J")
			print_prompt();
		}
	}
	console.log("\n")
	cur_prompt.active = false;
	return cur_prompt.text;
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
};
const emojis = require('./emojis.json')

const allowedChannelTypes = ['DM','GROUP_DM','GUILD_PUBLIC_THREAD','GUILD_PRIVATE_THREAD','GUILD_TEXT'];
const talkableSel = ['channel','message']; 
const mobile = process.stdout.columns<80;

let frame = 0;
let enableUpdates = true;
async function render(){
	let curframe = frame;
	frame += 1;
	let out = [];
	//server/channel/dm list
	{
		out.push([])
		let curout = out[out.length-1];
		let raw_guilds = await client.guilds.cache.map(guild => guild);
		let home_guilds = Array.from(raw_guilds);
		let raw_folders = Array.from(client.settings.guildFolder.cache).map(x=>x[1]).filter(x=>x.id);
		for(let a of raw_folders)
			for(let b of Array.from(a.guilds).map(x=>x[1]))
				if(home_guilds.includes(b))
					home_guilds.splice(home_guilds.indexOf(b),1);
		let folders = home_guilds.concat(raw_folders);
		for(let i in folders){
			let fold = folders[i];
			if(fold.color) //check if its really a folder
				fold.childs = Array.from(fold.guilds.map(g=>g));
			else fold.childs = [];
			fold.childs.sort((a,b)=>fold.guild_ids.indexOf(a.id)-fold.guild_ids.indexOf(b.id));
			fold.prefix=(i!=folders.length-1?'├':'└');
			fold.childprefix = (i!=folders.length-1?'│ ':'  '); 
		}
		let guilds = [];
		for(let i in folders){
			let fold = folders[i];
			guilds.push(fold);
			if(fold.open)
				for(let j in fold.childs){
					let child = fold.childs[j];
					child.prefix = fold.childprefix + (j!=fold.childs.length-1?'├':'└');
					child.childprefix = fold.childprefix + (j!=fold.childs.length-1?'│ ':'  ');
					guilds.push(child);
				}
		}
		data.guild_amt = guilds.length;
		curout.push((data.cur_guild==-1?data.cur_sel=='guild'?"\033[30;107m":"\033[30;47m":"") + client.user.username + "\033[0m")
		//dms
		if(data.guilds[-1]?.open){
			if(data.cur_guild==-1)data.cur_guild_obj = client.user;
			let channels = Array.from(await client.channels.cache.filter(c=>['GROUP_DM','DM'].includes(c.type))).map(e=>e[1]);
			channels.sort((a,b) => Number(BigInt(b.lastMessageId) - BigInt(a.lastMessageId)));
			for(let i in channels){
				let chan = channels[i];
				chan.viewable = true;
				let text = channels.length-1!=i?'│ ├':'│ └';
				text += (i==data.guilds[-1].cur_chan?data.cur_sel=='channel'?"\033[30;107m":"\033[30;47m":"");
				let temp = chan.recipient?.nickname??chan.recipient?.globalName??chan.recipient?.username??chan.name;
				if(temp!=null)
					text+=temp;
				else{
					let name = Array.from(chan.recipients).map(x=>x[1]).filter(x=>x.id!=client.user.id).map(x=>x.globalName).join(", ");
					text += name;
				}
				curout.push(text + "\033[0m");
				if(i==data.guilds[-1].cur_chan &&data.cur_guild==-1){
					data.cur_channel_obj = chan;
					data.cur_thing = chan;
				}
			}
			data.guilds[-1].chan_amt = channels.length;
		}
		for(let i in guilds){
			let guild = guilds[i]
			curout.push(guild.prefix + (i==data.cur_guild?data.cur_sel=='guild'?"\033[30;107m":"\033[30;47m":"")+guild.name+"\033[0m");
			if(i==data.cur_guild && data.cur_sel=='guild')
				data.cur_thing = guild;
			if(i==data.cur_guild){
				data.cur_guild_obj = guild;
			}
			if(data.guilds[i]?.open){
				let channels_raw = Array.from(await guild.channels.cache.map(c=>c));
				data.guilds[i].chan_amt = channels_raw.length;
				let channels = [];
				let cats = channels_raw.filter(channel=>!channel.parentId);
				for(let i in cats){
					let cat = cats[i];
					cat.childs = Array.from(channels_raw.filter(chan => chan.parentId == cat.id));
					cat.childs.sort((a, b) => a.position - b.position);
				}
				cats.sort((a, b) => (a.type=="GUILD_CATEGORY") - (b.type=="GUILD_CATEGORY") || a.position - b.position);
				for(let i in cats){
					let cat = cats[i];
					cat.prefix=guild.childprefix+(i!=cats.length-1?'├':'└');
					cat.childprefix = guild.childprefix + (i!=cats.length-1?'│ ':'  '); 
					channels.push(cat);
					if(cat.open)
						for(let j in cat.childs){
							let chan = cat.childs[j];
							chan.prefix=cat.childprefix+(j!=cat.childs.length-1?'├':'└');
							channels.push(chan)
						}
				}
				for(let j in channels){
					if(i==data.cur_guild)
						data.chan_amt = channels.length;
					let chan = channels[j];
					let text = chan.prefix;
					text += (j==data.guilds[i].cur_chan?data.cur_sel=='channel'&&data.cur_guild==i?"\033[30;107m":"\033[30;47m":"")
					curout.push(text + chan.name + "\033[0m");
					if(j==data.guilds[i].cur_chan && data.cur_sel=='channel' && data.cur_guild==i)
						data.cur_thing = chan;
					if(j==data.guilds[i].cur_chan && data.cur_guild==i)
						data.cur_channel_obj = chan;
				}
			}
		}
	}
	let len = 0;
	if(mobile&&data.cur_sel=='message')out.splice(-1);
	else out[0].forEach(e=>len=max(len,e.replaceAll(new RegExp("\033\[[0-9;]*?m","g"),'').length));
	//messages
	{
		out.push([])
		let curout = out[out.length-1];
		if(talkableSel.includes(data.cur_sel)){
			let chan = data.cur_channel_obj;
			if(allowedChannelTypes.includes(chan.type)&&chan.viewable){
				if(!(chan.id in data.channels))
					data.channels[chan.id] = {};
				if(!("msgs" in data.channels[chan.id])){
					data.channels[chan.id] = {msgs:[]};
					chan.messages.fetch({limit: 50}).then(msgs=>{;
						for(let a of msgs)
							data.channels[chan.id].msgs.unshift(a[1]);
						render();
					});
					curout.push('Loading...');
				}else{
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
						if(last!=msg.author.id||msg.type=='REPLY'){
							let temp = prefix+msg.author.username+"\033[0m";
							if(msg.type=='REPLY'){
								try{
									let reply = await msg.fetchReference();
									temp += " → " + reply.author.username + " → " + reply.content.replaceAll('\n','  ').slice(0,process.stdout.columns-11-msg.author.username.length-reply.author.username.length-len);
								}catch(err){
									temp += " → \033[3mDeleted Message\033[0m";
								}
							}
							curout.push(temp)
						}
						last = msg.author.id;
						let cont = msg.content;
						if('embeds' in msg){
							cont += "\n";
							for(let embed of msg.embeds)
								for(let e of ['title','description'])
									if(e in embed&&embed[e])
										cont += embed[e]
						}
						cont = cont.replaceAll('\033','^[').replaceAll('\013','^G');
						
						do{
							let line = cont.slice(0,process.stdout.columns-len-11).split(/[\n\r]/)[0];
							curout.push(prefix + "     " + line+"\033[0m")
							cont = cont.slice(line.length);
							if(line.length==0)cont = cont.slice(1);
							while(cont[0]=='\n'||cont[0]=='\r')
								cont=cont.slice(1);
						}while(cont.length>0);
						let emojis = Array.from(msg.reactions.cache);
						let temp = "";
						for(let a of emojis)
							temp += (a[1].count-1?a[1].count:"")+(a[0].length<5?a[0]:'?')+" ";
						if(temp) curout.push("     \033[100m "+temp+"\033[0m")
					}
				}
			}
			else if(chan.viewable==false){
				curout.push('Hidden!')
			}
		}
	}
	if(mobile&&data.cur_sel!='message')out.splice(-1);

	let lines = 0;
	for(let a of out)
		lines = max(lines,a.length)
	let lens = [];
	for(let a in out){
		lens.push(0)
		for(let b of out[a])
			lens[a] = max(lens[a],b.replaceAll(new RegExp("\033\[[0-9;]*?m","g"),'').length)
	}
	if(frame-1!=curframe||!enableUpdates) return;
	console.log('\n\n\n\n\n\n\n\n\n\n\033[2J')
	for(let a=0;a<lines;a++){
		for(let b in out){
			let text = out[b][a-lines+out[b].length]??"";
			let len = text.replaceAll(new RegExp("\033\[[0-9;]*?m","g"),'').length;
			if(out.length-1!=b)
				console.log(text+" ".repeat(lens[b]-len+5))
			else
				console.log(text);
		}
		console.log("\n")
	}
	await print_prompt()
}

(async ()=>{
	{
		let logintype = (await input('Log in using TOKEN or PASSWORD:')).trim();
		if(logintype.toUpperCase()[0]!='P'){
			let TOKEN = (await input('TOKEN: ')).trim();
			if(TOKEN.trim()=="") TOKEN = (""+fs.readFileSync('../token.txt')).trim();
			let pro = new Promise(res => client.once('ready',res))
			client.login(TOKEN)
			await pro;
		}else{
			let name = (await input('name:')).trim();
			let pass = (await input('password:')).trim();
			let mfa = (await input('mfa code (leave blank if not enabled):')).trim();
			let pro = new Promise(res => client.once('ready',res))
			client.normalLogin(name, pass, mfa)
			await pro;
		}
		console.log('logged in!')
		client.on('messageCreate',(msg)=>{
			if(msg.channel.id in data.channels){
				data.channels[msg.channel.id].msgs.push(msg);
			}
			if(msg.channel.id==data.cur_channel_obj?.id)
				render();
		})
	}
	let rend = true;
	while(true){
		if(rend)
			render();
		rend = true;
		let keypress = await input({raw:1});
		let key = keypress.sequence;
		if(key=='q'||key=='\u0003')
			process.exit()
		else if(key[0]=='\u001b'){
			if(key[2]=='A'){
				if(data.cur_sel=='guild') data.cur_guild=max(-1,data.cur_guild-1);
				if(data.cur_sel=='channel') data.guilds[data.cur_guild].cur_chan=max(0,data.guilds[data.cur_guild].cur_chan-1);
				if(data.cur_sel=='message') data.cur_message=max(data.cur_message-1,0);
			}
			if(key[2]=='B'){
				if(data.cur_sel=='guild') data.cur_guild=min(data.cur_guild+1,data.guild_amt-1);
				if(data.cur_sel=='channel') data.guilds[data.cur_guild].cur_chan=min(data.guilds[data.cur_guild].cur_chan+1,data.guilds[data.cur_guild].chan_amt-1);
				if(data.cur_sel=='message') data.cur_message=min(data.cur_message+1,data.channels[data.cur_channel_obj.id].msgs.length-1);
			}
			if(key[2]=='C'){
				if(data.cur_sel=='channel'&&data.cur_channel_obj.viewable){
					if(allowedChannelTypes.includes(data.cur_channel_obj.type)){
						data.cur_message = data.channels[data.cur_channel_obj.id]?.msgs?.length-1;
						data.cur_sel='message';
					}else
						data.cur_channel_obj.open = true;
				}
				if(data.cur_sel=='guild'){
					if(data.cur_guild!=-1&&data.cur_guild_obj.color)
						data.cur_guild_obj.open= true;
					else{
						data.guilds[data.cur_guild] = data.guilds[data.cur_guild]??{};
						data.guilds[data.cur_guild].open = true;
						data.guilds[data.cur_guild].cur_chan = data.guilds[data.cur_guild].cur_chan??0;
						data.cur_sel='channel';
					}
				}
			}
			if(key[2]=='D'){
				if(data.cur_sel=='guild'){
					if(data.cur_guild_obj.open)
						delete data.cur_guild_obj.open;
					else
						delete data.guilds[data.cur_guild]?.open;
				}
				if(data.cur_sel=='channel'){
					if(!data.cur_channel_obj.open)
						data.cur_sel='guild';
					else
						delete data.cur_channel_obj.open;
				}
				if(data.cur_sel=='message')
					data.cur_sel='channel';
			}
		}
		else if(key=='\r'){
			if(talkableSel.includes(data.cur_sel)&&allowedChannelTypes.includes(data.cur_channel_obj?.type)){
				let msg = await input({prefix:'< > '});
				if(!msg.includes("\033"))
					data.cur_channel_obj.send(msg).catch(()=>{});
			}
		}
		else if(key=='r'){
			if(data.cur_sel=='message'){
				let msg = await input({prefix:'<R> '});
				if(!msg.includes("\033"))
					data.cur_message_obj.reply(msg).catch(()=>{});
			}
		}
		else if(key==':'){
			frame+=1;
			let command = (await input({prefix:':'})).trim();
			if(command=='q'){
				process.exit();
				return;
			}
			log(eval(command));
			await input({raw:1});
		}
		else if(key=='+'){
			if(data.cur_sel=='message'){
				frame+=1;
				let emote = await input({prefix:'+ '});
				if(!emote.includes("\033")){
					try{
						if(emote in emojis)
							await data.cur_message_obj.react(emojis[emote]);
						else 
							await data.cur_message_obj.react(emote)
					}catch(err){
						console.log('unable to react!')
						await new Promise(res => setTimeout(res,1000)); 
					}
				}
			}
		}
		else if(key=='e'){
			if(data.cur_sel=='message'){
				frame+=1;
				let edit = await input({prefix:'<E> ',suggest:data.cur_message_obj.content});
				if(!edit.includes("\033")){
					try{
						if(edit.trim()=="")
							await data.cur_message_obj.delete()
						else
							await data.cur_message_obj.edit(edit)
					}catch(err){
						console.log('unable to edit')
						await new Promise(res => setTimeout(res,1000)); 
					}
				}
			}
		}else if(key=='d'){
			if(data.cur_sel=="message"){
				await data.cur_message_obj.author.createDM();
				data.cur_guild=-1;
				data.guilds[data.cur_guild] = data.guilds[data.cur_guild]??{};
				data.guilds[data.cur_guild].open = true;
				data.guilds[data.cur_guild].cur_chan = data.guilds[data.cur_guild].cur_chan??0;
				data.cur_sel='channel';
				let temp = Array.from(await client.channels.cache.filter(c=>c.type=='DM'));
				let channels = [];
				for(let e of temp)channels.push(e[1]);
				channels.sort((a,b) => Number(BigInt(b.lastMessageId) - BigInt(a.lastMessageId)));
				for(let i in channels){
					let chan = channels[i];
					if(chan.recipient.id==data.cur_message_obj.author.id){
						data.guilds[-1].cur_chan = i;
						break;
					}
				}
			}
		}else
			rend = false;
	}
})()
