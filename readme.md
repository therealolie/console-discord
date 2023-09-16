# Console-based discord client

## Limitations
 - this app was only tested on linux/android, prob works fine on on other platforms
 - custom emojis are displayed as '?'
 - no dms yet
 - if something is not described in controls, its probably not added

## Requirements
 - node
 - discord.js selfbot v13
   `npm install discord.js-selfbot-v13`
## Controls/Usage
 - up/down arrows to switch between servers/channels/messages
 - right arrow to go into a server/channel
 - left arrow to leave/hide server
 - enter to write a message
 - r to reply while selecting a message
 - e to edit a message
 - \+ to add reaction while selecting a message,
   enter the unicode version of the emoji, custom emojis not supported yet
 - q/CTRL+C to quit
 - : to evaluate javascipt code. Tips:
  - data.cur\_{THING}\_sel is the current selected THING, so guild, channel or message, if you know discord.js you can use this to perform actions which are unavaliable yet
  - to be added
