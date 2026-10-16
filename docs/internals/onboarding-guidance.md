# Onboarding guidance

The web wizard asks for one of four AI experience levels after Voice setup.
The Guide control lives in the sidebar. It changes levels, pauses guidance,
and resets progress without changing AIOS files.

`guidance.logic.ts` owns the written tip catalog, daily action checks, weekly
five-question checks, and thirty-day limits. Successful client commands emit
content-free action events. Counters stop at three. Daily and weekly records
have fixed limits. Local calendar days avoid daylight-saving time drift.

Each browser profile keeps separate records by environment and AIOS folder.
This is local progress, not cross-device sync or a hosted user account.
Changing level preserves progress. Reset requires confirmation.

Choosing a level does not start the coach. The file tour and first useful
result must activate it. That integration remains part of the AIOS setup slice.
Every level needs the basic tour; Builder also receives advanced tips.

Written tips make no AI call. An explanation requires a separate confirmation
that names the selected service and model. Explanations use plan mode with
approval-required access. Switching profiles discards late navigation.

The Guide uses one midnight timer while active. It releases that timer and
its action subscription on unmount. The renderer serves web and Electron.
Native mobile does not yet include the Guide interface.
