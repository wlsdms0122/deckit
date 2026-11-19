# DECKIT-38: Users and seats

Status: draft
Area: system

## Summary

A **user** is a principal that is no mod: who attaches to the system from outside it, and who is at the machine. This DECKIT fixes what a user is and how a host makes and removes one, the job a user's run holds and the permission `deckit.seat` that job alone holds, the **seat** a user sits at while its run goes, the local seat, whose each state the system keeps is, how a user is admitted to a seat and the two settings a host keeps of the seats, and the requests and the message by which a seat sends what its devices do and is handed what it perceives, which a layer over the system serves.

## Motivation

[A party from outside](../DECKIT-37/SPEC.md) proves which principal it is and hosts a run of it. It leaves open which principals there are beside the mods, and what such a run may ask. Where one implementation lets a party run as a mod and another does not, a key registered on one attaches as a mod's storage and connections and on the other attaches as nothing.

A party that attached has a run and no place: nothing says whose pointer moved or whose keys were typed. Where one implementation names the party in every request and another names a device, a party written once drives one desktop only. And where one implementation seats whoever holds a key and another asks whoever is there first, the same key is a way in on one and a question on the other, with no setting that says which.

## Rules

### A user

A **user** is a principal for which the system keeps a table `{ id, name }`: `id` the principal's id, of the grammar `id` as [the bundle](../DECKIT-2/SPEC.md) gives it, and `name`, a string, what a person reads the user as. A mod is no user, and a user is no mod. The users are kept as the host app quits and starts again.

A user is part of what its principal stored: erasing what the principal stored, as [storage](../DECKIT-13/SPEC.md) fixes it, erases the user with the keys authorized for it, as [a party from outside](../DECKIT-37/SPEC.md) fixes those.

No rule tells a user that a person acts through from one that a program acts through.

### A user's job

A proof of the handshake, as [a party from outside](../DECKIT-37/SPEC.md) fixes it, verifies for a user alone, and the run the transport connection then hosts runs the **user's job**:

| part of the job | what it holds |
|---|---|
| permissions | `deckit.seat`, and no other |
| principals reached by id | none |
| interfaces used | none |
| interfaces provided | none |

So a user's run stores and reads its own records, emits events and hears those named after its own id, and no other's, as [events](../DECKIT-12/SPEC.md) fix who hears one, and asks what `deckit.seat` guards. A request another permission guards is refused it at `call` with kind `NOT_PERMITTED`, as [the permissions](../DECKIT-3/SPEC.md) refuse one.

`deckit.seat` is held by a user's job and granted to no mod. No manifest is read against it: a mod that asks for it is answered `usable` false for it, marked system or not, as [the bundle](../DECKIT-2/SPEC.md) answers a permission nothing defines. A host or a layer that defines a permission of that id is refused the start with kind `PERMISSION`, as [embedding](../DECKIT-22/SPEC.md) refuses a permission the system does not take.

### A seat

A **seat** is where one user is at the system: the devices by which its input comes and what it perceives, both of which the layer that serves it fixes. It is a table:

| key | value |
|---|---|
| `id` | a string: `local` for the local seat, and `s` followed by the seat's number for any other |
| `user` | table `{ id, name }`: the user that sits at it |
| `local` | a boolean: whether it is the local seat |

A user sits at one seat at most, and a seat is one user's. A seat opens as a transport connection comes to host a run of its user, and `authenticate` answers it under `seat`. It closes as that run comes to `notRunning`, however the run ended.

The number of a seat counts the seats transport connections opened since the host app started, from 1: the first is `s1`, and no number is given twice in a start.

A user's run that failed counts toward no relaunch limit, as [the lifecycle](../DECKIT-5/SPEC.md) fixes that limit for a mod: a user whose runs failed sits again as it proves itself again.

### The local seat

The **local user** is the user of the id `local`: whoever is at the machine the host app runs on. Where no user is kept under that id as the host app starts, the system makes it, under a name the host gives.

The **local seat** is the seat `{ id = "local", local = true }` of the local user, whose devices are the machine's own. It opens as the host app starts and stays open until the host app quits. No run holds it, so no party sits at it: a party that proves the principal `local` is refused with kind `ALREADY_RUNNING`.

### Whose a state is

Every state the system and the layers over it keep is of one of three: of what the seats share, of a seat, or of the machine the host app runs on. There is nothing else for a state to be of, and a state is of one of them alone.

- **The shared state** is what runs: the runs of the mods, what they keep and show, and where what they show stands. It is one, so every seat meets the same, and a seat's input changes it for every seat. Inputs that reach one state are taken in the order they reach it, and a permission decides what a seat's input may do.
- **A seat's own state** is how the seat meets the shared state: what it looks at and how, where its keys go, and what a layer draws around the shared state for that seat alone. It changes by that seat's input alone. A seat shows in the shared state by what its input does, and by nothing else of its own.
- **The machine's state** is what the shared state runs on: its storage, its network and its devices, and who sits. What the machine shows of itself stands outside the shared state, so only whoever is at the machine meets it. What the shared state makes is kept in the machine's storage. The machine's say over the shared state reaches it as a permission alone, which the local seat holds first.

A state passes from one of the three to another by an input alone: what a seat's input carries out of the shared state goes to that seat's devices, and what it carries in comes from them. The shared state is kept whether a seat looks at it or not, and what no seat can meet has no seat to ask.

**Note.** Which permissions a seat holds, and how the local seat hands one on, are not fixed, and this DECKIT is not accepted before they are.

### Admission

Once a party's proof verifies, its user is **admitted**: the first of these that is so is what `authenticate` comes to.

1. A refusal at `call` with kind `ALREADY_RUNNING`, where the user sits at a seat, or a run of it is in a state other than `notRunning`.
2. Its result, at once, where the setting `asking` is false: the user sits.
3. Where `asking` is true, the host first sends the party the notification `attach/asking`, which holds no `params`, and asks the layer that serves the ask, below, whether the user may sit. Answered yes, the user sits, held again to the first item as it is answered, and `authenticate` answers its result. Answered no, `authenticate` is refused at `call` with kind `REFUSED`. It is answered no, too, where no layer serves the ask, where no answer came in 60 seconds, and where the layer's answer failed.

After a refusal the host closes the transport connection, as after any refusal of `authenticate`. A party that closes its transport connection while it waits is admitted no more, and whatever is answered then seats nobody.

### The settings

The system keeps two settings of the seats, as the host app quits and starts again:

| setting | value | where none is kept |
|---|---|---|
| `idleTime` | a number, 0 or more: how many seconds a seat's devices give no input for before the seat is idle | 300 |
| `asking` | a boolean: whether a user that attaches waits for an answer before it sits, under *Admission* | `false` |

A seat is **idle** once `idleTime` seconds have passed since its devices last gave input, or since it opened where they gave none. For a seat a transport connection opened, its devices give input as its party asks `seat/input`. Whether a seat is idle decides nothing of admission. What it decides is the layer's that serves the seats: for the shell, [seats at the desktop](../DECKIT-39/SPEC.md) fixes it.

`asking` is read as each proof verifies, so a change holds from the next `authenticate` on, and a user that waits for an answer as `asking` turns false waits on for it.

### What a seat asks and is told

A party whose run sits at a seat asks these requests, and is sent this notification, beside those of [a party from outside](../DECKIT-37/SPEC.md). None names a seat: the seat is the one the transport connection's user sits at. `deckit.seat` guards each request.

| message | `params` | what it is |
|---|---|---|
| `seat/input`, a request | table `{ event, type }` and what the event holds besides | what the seat's devices did; it answers what the layer that serves input answers |
| `seat/read`, a request | table `{ of }` and what the output is asked with besides | an output asked once; it answers what the layer that serves a reading answers |
| `seat/watch`, a request | table `{ of, on }`, `on` a boolean | whether the seat is told of the output `of` from now on; it answers `true` |
| `seat/output`, a notification the host sends | table `{ of }` and what the output tells besides | an output the seat is told of |

`event` names a kind of device and `type` one of its events, and `of` names an output, which is read, told, or both. Which there are is named by the layer that serves them, under *What a layer serves*.

A seat is told of an output while it watches it: from a `seat/watch` with `on` true until one with `on` false, and, for an output the layer that tells it names so, from the moment the seat opens. What a seat is told arrives in the order the layer told it.

A request is refused at `call` with the first of these that is so:

1. kind `INVALID_ARGUMENT`, where its `params` are refused by the one rule [a party from outside](../DECKIT-37/SPEC.md) holds the `params` of every request to, the keys a request takes being those of its row, any others besides for `seat/input` and `seat/read`;
2. kind `REFUSED`, where it is `seat/input` or `seat/read` and no layer serves it;
3. kind `INVALID_ARGUMENT`, where `event` names no kind of device the layer that serves input names, `type` is none of that kind's, or a key beside `event` and `type` is none that kind's event holds; where `of` names no output the layer that serves a reading reads, or a key beside `of` is none that output is asked with; or, for `seat/watch`, where `of` names no output a layer tells.

Which events and outputs a layer names, what each holds beside these keys, what each answers and what it is refused with besides are fixed by the DECKIT of the layer that serves it: for the shell's input and the output `held`, [seats at the desktop](../DECKIT-39/SPEC.md); for the shell's readings, a picture and the output `changes`, [what a seat reads](../DECKIT-40/SPEC.md).

### What a layer serves

A layer the host stacks over the system may serve each of these, and each is served by one layer at most:

| what | handed | answers |
|---|---|---|
| input | the seat, and the `params` of a `seat/input` | what `seat/input` answers, or its refusal |
| a reading | the seat, and the `params` of a `seat/read` | what `seat/read` answers, or its refusal |
| the ask | the user that waits, as `{ id, name }` | whether it may sit, a boolean |

A layer that serves input names the kinds of device it takes, each with its types and what an event of it holds besides; one that serves a reading names the outputs it reads, each with what it is asked with besides; and a layer names the outputs it tells, each with what it tells and whether a seat is told it from the moment it opens. An output is named by one layer at most.

A layer serves the local seat as it serves any other. A layer tells a seat an output, `{ of }` with what the output tells: it is sent as `seat/output` to the party of a seat that watches `of`, and the local seat is sent none.

**Note.** How a layer is handed these, and how it tells, are the implementation's, as [embedding](../DECKIT-22/SPEC.md) leaves how a host hands the system anything. The system alone knows which transport connection a seat is; a layer is handed seats and knows no party.

### What a host asks

Only the host makes a user, removes one, reads the users, the seats and the settings, and sets a setting. No permission guards what a host asks, and no run asks it.

- **Making a user** `{ id, name }` keeps it; one kept already under `id` takes the new `name`. It is refused at `call` with kind `INVALID_ARGUMENT` where `id` is no `id`, and with kind `REFUSED` where a mod is listed under `id`, as [the catalog](../DECKIT-4/SPEC.md) lists one.
- **Removing a user** by its id asks the end of the run it has, if any, and erases what its principal stored, the user and its keys among it. It is refused at `call` with kind `NOT_FOUND` where no user is kept under the id.
- **The users** are read as an array of `{ id, name }`, in the order of the code points of their ids.
- **The seats** are read as an array of seats, in the order they opened.
- **The settings** are read as `{ idleTime, asking }`. Setting one keeps it and leaves the other as it was. It is refused at `call` with kind `INVALID_ARGUMENT` where `idleTime` is below 0.

A user is made, removed and read, and a setting set, with the host app started or not.

## Interactions

- A principal, the handshake, `authenticate` and its result, a party's run and what ends it, the authorized keys, `NOT_AUTHENTICATED` and `ALREADY_RUNNING`: [a party from outside](../DECKIT-37/SPEC.md).
- The `id` grammar, and what a manifest is answered of a permission nothing defines: [the bundle](../DECKIT-2/SPEC.md).
- `NOT_PERMITTED`, and the permissions a mod is granted: [the permissions](../DECKIT-3/SPEC.md).
- A run's states and the relaunch limit: [the lifecycle](../DECKIT-5/SPEC.md).
- Who hears an event: [events](../DECKIT-12/SPEC.md).
- Erasing what a principal stored: [storage](../DECKIT-13/SPEC.md).
- A layer a host stacks, and `PERMISSION` at the start: [embedding](../DECKIT-22/SPEC.md).
- The users and keys a case's host makes, and a party of a case: [the case format](../DECKIT-1/SPEC.md).
- What of the desktop is the shared state and what is a seat's own: [seats at the desktop](../DECKIT-39/SPEC.md).
- `REFUSED` of an admission, and `INVALID_ARGUMENT`, `REFUSED` and `NOT_FOUND` of a seat's requests and of what a host asks: here.

## Alternatives considered

- A party that runs as a mod. A key would then reach a mod's records and connections from outside its sandbox, and a mod's run would have two hosts; a user is a principal of its own, with a job that holds one permission.
- A seat named in every request. A party would name another's seat; the transport connection says whose it is, as it says the principal and the run.
- A list of what the seats share and what is each seat's. A state the list leaves out would have no rule, and every state it names would weigh on how the next is read; three things a state can be of hold every state, the next one too.
- The kinds of device and the outputs named here, for every layer. A layer that takes other devices or hands a seat other outputs, as one that shows no desktop, could not be stacked without this DECKIT changing; the layer that serves them names its own.
- The local seat as a thing apart from seats. Every rule of a seat would gain a second case for the machine's own devices; the local seat is a seat whose devices are the machine's, and whoever attaches stands as the one at the machine does.
- Admission decided by how long the local seat gave no input. Whoever attaches while nobody is at the machine would sit unasked or never, by a clock; the setting says which, and the idle time decides nothing of it.

## Notes

**Note.** What this costs an implementation: it keeps a user record with what a principal stored, launches a run for a user with a job no bundle gave, keeps a table of seats for a start, holds an `authenticate` open while an ask is answered, and carries a seat's requests to whichever layer serves them.

**Note.** No case holds these, each for its reason. The 60 seconds of an ask, since a case does not wait a minute. A setting set after the start or read, a user removed or made after the start, a user under a mod's id, and the users and the seats read: [the case format](../DECKIT-1/SPEC.md) gives a case's host its users, its keys and its settings before the first start and nothing later. An ask whose answer failed: the shell of the base `shell`, the one layer of a case that serves the ask, answers yes or no and nothing else. What a seat that is idle decides: [seats at the desktop](../DECKIT-39/SPEC.md) fixes it for the shell, and its cases hold it. A user erased with what its principal stored: a case's host erases no principal that is no mod. That the local user is made under the host's name: no party reads a user it is not.

**Note.** The base `system` of a case stacks no layer that serves a seat, so its cases hold `INVALID_ARGUMENT` of `params` the one rule refuses, `REFUSED` of `seat/input` and `seat/read`, and `INVALID_ARGUMENT` of a `seat/watch` of an output none tells, and nothing a layer names, answers or tells: no `seat/output`, that of `held` from the moment a seat opens among them, and no second layer that serves what one serves already. The refusals of what the shell names are held by the cases of [seats at the desktop](../DECKIT-39/SPEC.md) and [what a seat reads](../DECKIT-40/SPEC.md).
