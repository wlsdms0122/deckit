# DECKIT-37: A party from outside

Status: draft
Area: system

## Summary

Code that the system did not start reaches it over a **transport connection** it opens from outside the host app: a **party**. This DECKIT names what the system runs code for and keeps storage for, a **principal**, of which a mod is one; and fixes the transport and its messages, the handshake by which a party proves which principal it is with a key authorized for that principal, the bytes it signs, the refusals, that a party so proved is a run of its principal hosted by its transport connection, what such a run asks and is told, what ends it, and the authorized keys a host registers.

## Motivation

A mod's run is started by the system, in a page the system made, so the system knows whose run it is without being told. A program on the same machine that wants to act as a principal has no such page. It opens a connection, and whose it is, is a claim.

Where one implementation takes the claim and another asks for a secret kept in a file, the same party attaches to one and not to the other, and on the first any program of the machine reads and writes what the principal stored. Where two implementations both check a signature and sign different bytes, a party written once attaches to one only. Where one tells a party that the principal it named does not exist and another answers as for a wrong key, the first lists the principals to whoever asks.

Where a party that attached is something beside a run, every rule of [connections](../DECKIT-9/SPEC.md), [events](../DECKIT-12/SPEC.md) and [storage](../DECKIT-13/SPEC.md) needs a second case for it, and two implementations write that case differently.

## Rules

### A principal

A **principal** is what the system runs code for and keeps storage for, named by an id, a string of the grammar `id` as [the bundle](../DECKIT-2/SPEC.md) gives it. A mod is a principal, under its id. What a principal's run may ask is what the **job** it runs holds: its permissions, the principals it reaches by id, and the interfaces it uses and provides. A mod's job holds what its bundle and [the permissions](../DECKIT-3/SPEC.md) give it. No rule tells a principal that a person acts through from one a program acts through.

### The transport

A host app that is started listens on a local stream socket, the file `deckit.sock` in the system's own folder. Only the account that runs the host app can open the file. A file left at that path as the host app starts is removed before it listens, and the file is gone once the host app has quit.

Each connection a party opens to the socket is a **transport connection**. Both ends send messages over it; either end closes it.

### Messages

A message is a JSON-RPC 2.0 object written as UTF-8 text on one line, and each line ends with LF. An empty line is no message. A message that holds `method` and `id` is a **request**, answered by one message of the same `id` that holds `result`, or `error`; one that holds `method` and no `id` is a **notification**, and is answered by nothing. Either end sends both.

A refusal, as [the specification](../README.md) fixes one, is an error of this form:

| key | value |
|---|---|
| `code` | the integer -32803 |
| `message` | a string, which no rule fixes |
| `data` | table `{ stage, kind }`: the refusal's stage and its kind |

The host closes the transport connection, and answers nothing, where a line is not a JSON object, or is longer than its bound: 4096 bytes until `authenticate` has answered a result, and 1048576 bytes from then on.

### The handshake

A party asks two requests, in this order, each once:

| request | `params` | `result` |
|---|---|---|
| `initialize` | table `{ protocol, nonce }`: `protocol` the integer 1; `nonce`, a string, the base64 of 32 bytes the party chose | table `{ protocol, challenge, schemes }`: `protocol` the integer 1; `challenge`, a string, the base64 of 32 bytes the host chose at random for this transport connection; `schemes`, an array of strings, the signature schemes the host verifies |
| `authenticate` | table `{ principal, scheme, key, signature }`: `principal`, a string, the id the party claims; `scheme`, a string, one of `schemes`; `key`, a string, the base64 of the public key; `signature`, a string, the base64 of the signature of *what is signed* by the private key of `key` | table `{ principal, run, permissions, end }`: `principal` the id proved; `run`, an integer, the number of the run the transport connection now hosts, 1 for a principal's first and one more for each after; `permissions`, an array of strings, the id of each permission the run's job holds; `end`, a number, how many seconds a lifecycle is given to end, as [the lifecycle](../DECKIT-5/SPEC.md) fixes that time |

The one scheme is `ed25519`: Ed25519 as RFC 8032 fixes it, its public key 32 bytes and its signature 64.

A request is answered with the first of these that is so:

1. an error whose `code` is -32600, which holds no `data`, where it is `initialize` and `protocol` is not 1, or `initialize` was answered a result before;
2. a refusal at `call` with kind `INVALID_ARGUMENT`, where it is `initialize` and `nonce` is not the base64 of 32 bytes;
3. an error whose `code` is -32002, which holds no `data`, where it is any other request and `authenticate` has not answered a result on this transport connection;
4. a refusal at `call` with kind `NOT_AUTHENTICATED`, where it is `authenticate` and the proof does not verify: `scheme` is none of `schemes`, `principal` is no `id`, no key is authorized for `principal`, `key` is not one authorized for it, or `signature` is not the signature of *what is signed* by `key`;
5. a refusal at `call` with kind `ALREADY_RUNNING`, where it is `authenticate`, the proof verifies and a run of the principal is in a state other than `notRunning`, as [the lifecycle](../DECKIT-5/SPEC.md) names the states;
6. an error whose `code` is -32601, which holds no `data`, where its `method` is none of *What a party asks*.

Every cause of `NOT_AUTHENTICATED` is answered alike: nothing of the answer, its message among it, differs by which cause it was, so a party learns of no principal, nor of any key, by asking. The host reads and tells nothing of a principal before the proof verifies. After a refusal of `authenticate` the host closes the transport connection. A challenge is verified against once: a second `authenticate` finds none.

### What is signed

The party signs these bytes, in this order, with nothing between them:

| bytes | what they are |
|---|---|
| `deckit-authenticate-1` | 21 bytes, the label in US-ASCII |
| one byte, 0 | |
| `principal` | the id claimed, in UTF-8 |
| one byte, 0 | |
| `challenge` | the 32 bytes the host answered |
| `nonce` | the 32 bytes the party sent |
| the binding | what ties the signature to the transport: for the local socket, no bytes |

### A party's run

A transport connection whose `authenticate` answered a result **hosts a run** of the principal proved: the run is that principal's as a mod's run in its page is the mod's, under every rule of [the lifecycle](../DECKIT-5/SPEC.md), [connections](../DECKIT-9/SPEC.md), [calls across a connection](../DECKIT-11/SPEC.md), [events](../DECKIT-12/SPEC.md) and [storage](../DECKIT-13/SPEC.md) that speaks of a mod's run, read for its principal. A principal has one run at a time, whatever hosts it. What the run may ask is what its job holds, and what it asks beyond that is refused as those rules refuse a mod's run. The run stores and reads its principal's records, hears the events its principal may hear, and what it emits is named after its principal.

The run is `launching` as `authenticate` answers and `running` once the party has asked `runner/started`.

### What a party asks

Each is a request the party sends once it hosts a run. None names the principal or the run: the transport connection says both. `lifecycle` is the number of one of the run's lifecycles, and a crossing value is a table `{ value, references }`: `value` what crosses, as [calls across a connection](../DECKIT-11/SPEC.md) fix what may, each function in it written as a null; `references` an array of arrays `[path, number]`, one for each function, `path` the array of keys and places that lead to it in `value` and `number` the integer the function is called by.

| request | `params` | answers |
|---|---|---|
| `runner/started` | table `{ contributions }`, `contributions` a table `{ exportedIn, awaits }` | nothing, once the run is `running` |
| `runner/problem` | table `{ problem }`, a string | nothing: a problem of the run, as [the lifecycle](../DECKIT-5/SPEC.md) fixes one |
| `runner/quit` | none | nothing: the run asks its own end |
| `connection/begin` | table `{ lifecycle }` | an array of the connections the lifecycle has, each a table `{ id, name, exports }` or `{ name, refusal }` |
| `connection/end` | table `{ lifecycle }` | nothing, once the lifecycle's connections have ended |
| `connection/reach` | table `{ lifecycle, target }`, `target` the id of a principal | nothing, once the lifecycle reaches for `target` |
| `connection/release` | table `{ lifecycle, target }` | nothing, once it reaches for it no more |
| `connection/call` | table `{ connection, number, args }`, `args` a crossing value | table `{ returned }` or `{ thrown }`, each a crossing value |
| `connection/let-go` | table `{ connection, number, count }` | nothing: the party holds the function `number` `count` times fewer |
| `event/listen` | table `{ names }`, an array of strings | nothing, once the run hears each event named |
| `event/emit` | table `{ name, args }` | nothing, once the event is emitted |
| `record/read` | table `{ key }` | the record under `key`, or a null where there is none |
| `record/write` | table `{ key, value }` | nothing, once the record is kept |
| `record/remove` | table `{ key }` | nothing, once no record is kept under `key` |
| `record/keys` | none | an array of the key of each record kept, in the order of their code points |

Each is refused as the rule it reads from refuses the request of a mod's run it stands for, at that stage and with that kind.

### What a party is told

| message | `params` | when |
|---|---|---|
| `connection/connected`, a notification | table `{ id, name, exports, lifecycle }` | a connection of the lifecycle stands |
| `connection/unreached`, a notification | table `{ lifecycle, name, refusal }` | a connection it waits for does not come to stand |
| `connection/disconnected`, a notification | table `{ id }` | the connection has ended |
| `connection/connect`, a request | table `{ id, name, mod, lifecycle, credential }` | the run is the service of a connection being made; it answers its exports |
| `connection/called`, a request | table `{ connection, number, args }` | a function the party handed across is called; it answers `{ returned }` or `{ thrown }` |
| `connection/let-go`, a notification | table `{ connection, number, count }` | the other end holds a function the party handed `count` times fewer |
| `event/deliver`, a notification | table `{ name, args }` | an event the run hears was emitted |
| `runner/stop`, a request | none | the run's end is asked; it answers once it has ended what it runs |

### What ends it

A run a transport connection hosts ends in one of these ways:

1. The party asks `runner/quit`, or the system ends the run as [the lifecycle](../DECKIT-5/SPEC.md) ends any. The host asks `runner/stop`, and closes the transport connection once the party has answered, or once the time an end is given has passed.
2. The transport connection closes with no `runner/stop` answered, by either end. The run has failed, as a mod's run whose page went away has.

After either, the principal has no run, and a party that proves it again hosts a new one.

### The authorized keys

For each principal the system keeps its **authorized keys**: the public keys that may authenticate as it, each a table `{ scheme, key, name }`, `scheme` a signature scheme, `key` the base64 of the public key and `name` a string the host chose. They are kept as the host app quits and starts again. The system holds no private key.

Only the host registers a key, removes one and reads those of a principal; no permission guards what a host asks, and no run asks it. A key registered for a principal under a `scheme` and `key` it holds already takes the new `name` and is held once. Registering is refused at `call` with kind `INVALID_ARGUMENT` where `principal` is no `id` or `key` is not a public key of `scheme`.

A key is read as each proof is verified: one registered is taken, and one removed refused, from the next `authenticate` on, with the host app started or not. A run hosted on a key since removed goes on.

The authorized keys are part of what a principal stored: erasing what a mod stored, as [storage](../DECKIT-13/SPEC.md) fixes it, erases its keys, so a principal made again under the same id inherits none.

## Interactions

- The `id` grammar: [the bundle](../DECKIT-2/SPEC.md).
- What a mod is granted, and `NOT_PERMITTED`: [the permissions](../DECKIT-3/SPEC.md).
- A run, its states, a problem, the time an end is given and how a run fails: [the lifecycle](../DECKIT-5/SPEC.md).
- A connection, its client and service, `credential` and reaching by id: [connections](../DECKIT-9/SPEC.md).
- What crosses a connection, and a function called across it: [calls across a connection](../DECKIT-11/SPEC.md).
- Who hears an event, and how one is named: [events](../DECKIT-12/SPEC.md).
- Records, their keys, and erasing what a mod stored: [storage](../DECKIT-13/SPEC.md).
- `NOT_AUTHENTICATED` and `ALREADY_RUNNING`: here.
- Which job a principal that is no mod runs: no rule here.

## Alternatives considered

- A party as an endpoint of its own beside runs. Every rule of connections and events would gain a second case; as a run, a party is held to the rules a mod's run is held to, and nothing else.
- A second party of a principal that runs replacing the first. Whoever holds a key would end a live run; refused, the first goes on and the second is told why.
- A secret kept in a file, sent as it is. Whoever reads it once is the principal for ever, and it cannot be carried to another transport; a signature over a fresh challenge proves the key without sending it.
- Signing the challenge alone. A signature made for one use of the key would pass for another; the label, the principal and the party's own nonce make it a signature of this handshake and no other.
- A refusal that says which part of the proof failed. A party would learn which principals exist and which keys they hold.
- The keys in a file a person edits. An edit would grant a login, and erasing a principal would have a second place to clear.
- A transport connection that closes without `runner/quit` counted as a quit. A party that crashed would look like one that ended well; one rule holds for a page gone and a party gone.

## Notes

**Note.** The file's mode and the key are two gates: the mode says which account, the key which principal. On one machine and one account the key does not keep other software of that account from reading the private key's file.

**Note.** Another transport changes how bytes are carried and the binding in *What is signed*. The messages, the handshake and the keys stay.

**Note.** What this costs an implementation: it listens where only its own account reaches, verifies a signature before it reads anything of the principal named, answers every failed proof alike, carries a run's requests and what it is told over the transport connection as it carries them to and from a page, and keeps each principal's keys with what the principal stored.
