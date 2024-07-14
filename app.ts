import { AWClient } from "aw-client";
import { WindowsToaster } from "node-notifier";
import type { IEvent } from "aw-client";
import getPid from "find-process";
const client = new AWClient("test-client");
const bucketId = "aw-watcher-window_BW-3";

let limitReachedArray: string[] = [];
let totalTimeOnApps: { [key: string]: number } = {};
/** An executable or matched regex portion (window title) and a time limit as an integer in minutes */
let limitedApps: { [key: string]: number } = {
  "chrome.exe": 5,
  "Visual Studio Code": 20,
};
let limitedTitleRegex: RegExp = /.*(Visual Studio Code).*/;

const updateTotalTime = (events: IEvent[]) => {
  for (let i = 0; i < events.length; i++) {
    let ev = events[i];
    const appName = ev.data.app.toString();
    const windowTitle = ev.data.title.toString();
    const duration = ev.duration;
    const match = limitedTitleRegex.exec(windowTitle);
    if (match && !limitReachedArray.includes(match[1])) {
      console.log("matched:", match[1]);
      if (!(match[1] in totalTimeOnApps)) totalTimeOnApps[match[1]] = 0;
      totalTimeOnApps[match[1]] += duration ?? 0;
    }
    if (appName in limitedApps && !limitReachedArray.includes(appName)) {
      if (!(appName in totalTimeOnApps)) totalTimeOnApps[appName] = 0;
      totalTimeOnApps[appName] += duration ?? 0;
    }
  }
  // check if the time exceeds the limit, and if so, append it to the limitReachedArray.
  for (const key in totalTimeOnApps) {
    console.log(key);
    const totalMinutes = Math.floor(totalTimeOnApps[key] / 60);
    console.log(totalMinutes, "minutes");
    if (totalMinutes > limitedApps[key]) {
      limitReachedArray.push(key);
    }
  }
};

const checkAndNotify = () => {
  limitReachedArray = [];
  totalTimeOnApps = {};
  client
    .getEvents(bucketId, {
      start: new Date(new Date().setHours(0, 0, 0, 0)),
      end: new Date(Date.now()),
      limit: 250,
    })
    .then((events) => {
      updateTotalTime(events);
      let notifier = new WindowsToaster({
        withFallback: false, // Fallback to Growl or Balloons?
        customPath: undefined, // Relative/Absolute path if you want to use your fork of SnoreToast.exe
      });

      if (limitReachedArray.length > 0) {
        for (let i = 0; i < limitReachedArray.length; i++) {
          notifier.notify(
            {
              title: "Limit Reached", // String. Required
              message: `You have reached the screen time limit for ${limitReachedArray[i]}`, // String. Required if remove is not defined
              icon: "C:\\bin\\aw.png", // String. Absolute path to Icon
              sound: false, // Bool | String (as defined by http://msdn.microsoft.com/en-us/library/windows/apps/hh761492.aspx)
              id: undefined, // Number. ID to use for closing notification.
              appID: "Activity Watch", // String. App.ID and app Name. Defaults to no value, causing SnoreToast text to be visible.
              remove: undefined, // Number. Refer to previously created notification to close.
              install: undefined, // String (path, application, app id).  Creates a shortcut <path> in the start menu which point to the executable <application>, appID used for the notifications.
            },
            function (error, response) {
              console.log(response);
            }
          );
          //TODO: Fix PID doesn't exist error
          // getPid("name", limitReachedArray[i]).then((instances) => {
          //   console.log("instances", instances);
          //   instances.forEach((instance) => process.kill(instance.pid));
          // });
        }
      }
    });
};
checkAndNotify();
setInterval(checkAndNotify, 60000);
