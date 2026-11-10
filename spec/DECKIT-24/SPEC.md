# DECKIT-24: Fetching through a session

Status: draft
Area: web

## Summary

A mod reads an address on the web through one of its sessions with `fetch(url, init)`, a member of a session handle as [the web engine](../DECKIT-23/SPEC.md) fixes one. This DECKIT fixes the request: what it takes, `url` and the table `init` of `method`, `headers`, `body` and `redirect`, what it sends, the session's cookies among it, what it answers, `{ url, status, headers, body, redirected }`, how it follows a redirect, the limit on what it is answered, the cookies an answer sets kept in the session, and how it is refused. It does nothing with what it is answered but answer it: it runs no script of it and loads nothing it names.

## Motivation

A mod that syncs a feed from a site a person signed in to in the mod's web page reads it through the same session, with the cookies the page was signed in with:

```js
const session = web.session("main");
const { status, body } = await session.fetch("https://example.com/feed", { headers: [["accept", "application/json"]] });
```

The request is the web engine's: a mod's own code reaches the web only from its page, where the rules that keep one site from reading another hold it, and the cookies of a session are the web engine's store, which no mod's code reads. Each of these is a call two implementations could answer differently without a rule:

- `session.fetch("https://example.com/")` answers the object a page's own fetch answers on one implementation, which is no value, and on another a table of values; its body is text on one, which loses the bytes of an image, and bytes on another.
- A site answers two `set-cookie` headers. One implementation answers a table of headers keyed by name, which keeps one of them; another answers both.
- `session.fetch("ftp://example.com/")` is refused with `INVALID_ARGUMENT` on one implementation and throws an error with no kind on another; a body handed with `GET` is sent on one and refused on another.
- A site redirects a request 25 times. One implementation follows them all, and another refuses at the 21st. A `POST` answered `303` is sent again as a `POST` on one and as a `GET` on another.
- A site answers 2 GB. One implementation holds all of it in the app's process; another refuses at a limit, and a mod cannot tell from the refusal's kind that the answer was too large.
- mod-a signs in to a site through its session `main`, and mod-b fetches the site through its own session `main`. mod-b is sent mod-a's cookies on one implementation and none on another.
- A site answers a page whose script reads more of the site. One implementation runs it, and the mod is answered what the page came to; another answers the bytes the site sent.

## Rules

### The request fetch

`fetch(url, init)`, a member of a session handle, is a request, as [the web engine](../DECKIT-23/SPEC.md) fixes the members of one:

| argument | takes | required | what it says |
|---|---|---|---|
| `url` | string | yes | the address fetched: an absolute URL, as the URL standard of the web parses one, whose scheme is `http` or `https` |
| `init` | table `{ method, headers, body, redirect }` | no | how it is fetched; left out, the table with no keys |
| `init.method` | string, a `method` | no | the request's method; left out, `GET` |
| `init.headers` | array of arrays `[name, value]`, each a string | no | the headers the request carries, in order; left out, none |
| `init.body` | string, a `base64` | no | the bytes the request carries, in base64; left out, none |
| `init.redirect` | string, `"follow"`, `"error"` or `"manual"` | no | what the request does with a redirect, under *Redirects*; left out, `"follow"` |

What each takes is fixed by this grammar, where a header's `name` is a `token` and its `value` a `field-value`:

```
method      = token
token       = 1*tchar
tchar       = "!" / "#" / "$" / "%" / "&" / "'" / "*" / "+" / "-" / "." /
              "^" / "_" / "`" / "|" / "~" / DIGIT / ALPHA
field-value = *( %x01-09 / %x0B-0C / %x0E-10FFFF )   ; any code point but NUL, LF and CR
base64      = *( 4b64 ) [ 2b64 "==" / 3b64 "=" ]
b64         = ALPHA / DIGIT / "+" / "/"
```

It is refused with the first of these that is so; refused with one of the first four, it sends nothing, and with one of the last two, it answers nothing:

1. as [the permissions](../DECKIT-3/SPEC.md) refuse a request a permission guards, at `call` with kind `NOT_PERMITTED`, where the mod is not granted `system.network`;
2. as [the handle](../DECKIT-7/SPEC.md) refuses a request whose arguments do not fit what it takes, at `call` with kind `INVALID_ARGUMENT`;
3. at `call` with kind `ENDED`, where the session handle is cut, as [the web engine](../DECKIT-23/SPEC.md) fixes it;
4. at `call` with kind `INVALID_ARGUMENT`, where `url` is not an absolute URL whose scheme is `http` or `https`, `method` is not a `method`, an element of `headers` is not an array of two strings, a header's name is not a `token` or its value not a `field-value`, `body` is not a `base64`, `body` is handed with the method `GET` or `HEAD`, compared ignoring case, or `redirect` is none of the three;
5. at `call` with kind `QUOTA_EXCEEDED`, where the answer is over the limit, under *The answer*;
6. at `call` with kind `REFUSED`, where the request is not answered: no answer comes, as a connection fails or a site sends nothing HTTP reads, or a redirect is refused, under *Redirects*.

A fetch that is sent **uses** its session, as [the web engine](../DECKIT-23/SPEC.md) fixes it, answered or refused: a fetch refused with 1 to 4 does not.

### What it sends

A fetch sends one HTTP request to the URL `url` names, as the URL standard writes it again once parsed, through the session. It carries:

| what | as it is sent |
|---|---|
| the method | `method`: in upper case where it is `DELETE`, `GET`, `HEAD`, `OPTIONS`, `POST` or `PUT`, compared ignoring case, and as it is handed where it is another |
| the headers | each header of `headers`: a name handed more than once, compared ignoring case, is sent once, its values joined by `,` in the order handed |
| the body | the bytes `body` holds; none where it is left out |
| the cookies | the cookies the session holds that HTTP's state management sends with a request to that URL, and no other session's |

It carries besides the headers the session writes itself, which this DECKIT does not fix: under *Notes*.

The cookies each answer sets, by its `set-cookie` headers, are kept in the session as HTTP's state management keeps them, the answers of the redirects it follows among them: a later fetch through the session sends them, and no fetch through another session does, of the same mod or another's. A cookie an answer sets with no time it expires is kept as one that expires 1209600 seconds, 14 days, after it is kept. What the session keeps stays as the host app quits and starts again, until the mod clears it or is erased, as [the web engine](../DECKIT-23/SPEC.md) fixes them.

**Note.** A cookie that expires as the session ends would end as the host app quits, since a session lasts as long as the app does, and a person signed in to a site in a mod would be signed out at each start; 14 days is a time a person stays signed in.

### Redirects

A **redirect** is an answer whose status is 301, 302, 303, 307 or 308 and that has a `location` header. As `redirect` says:

| `redirect` | what a redirect does |
|---|---|
| `"follow"` | the request is sent again to the URL `location` names, read against the URL the redirect answered, and the answer is that of the last request sent |
| `"error"` | the request is refused at `call` with kind `REFUSED` |
| `"manual"` | the redirect is the answer, and no request is sent again |

A redirect followed sends again, of a status 301 or 302 to a `POST`, and of a status 303 to any method but `HEAD`, a `GET` with no body; and of every other, the request's method and body. A fetch follows at most 20 redirects: a request redirected a 21st time is not answered, and is refused at `call` with kind `REFUSED`.

### The answer

A fetch answers a table:

| key | value |
|---|---|
| `url` | string: the URL that answered, after the redirects followed, as the URL standard writes it |
| `status` | integer: the answer's status, whatever it is |
| `headers` | array of arrays `[name, value]`, each a string: one for each name the answer holds, in lower case, in the order of their code points; a name the answer repeats is answered once, its values joined by `, ` in the order answered |
| `body` | string, a `base64`: the bytes the answer holds, with a content coding of `gzip` or `deflate` undone, the empty string where it holds none; left out for a status that has no body: 101, 103, 204, 205 and 304 |
| `redirected` | boolean: `true` where a redirect was followed |

The **limit** is 4194304 bytes, 4 MiB. An answer whose bytes, its content coding undone, are more than the limit, or whose `content-length` is more than the limit, is over it: the fetch stops reading it, and is refused at `call` with kind `QUOTA_EXCEEDED`.

A fetch answers the bytes it is answered and does nothing more with them: it runs no script of them, and loads nothing they name.

**Note.** What a fetch answers is read whole in the app's process before it is handed to the mod, so an answer with no limit would hold as much of the app as a site sends. A mod that needs more reads it in parts, by what the site lets it ask for, or shows the page.

## Interactions

- The session handle `fetch` is a member of, a session, a session handle cut and `ENDED`, a session used, and what `clear()` and erasing take: [the web engine](../DECKIT-23/SPEC.md).
- `system.network`, which the web engine defines and which guards `fetch`: [the web engine](../DECKIT-23/SPEC.md). What a mod is granted and `NOT_PERMITTED`: [the permissions](../DECKIT-3/SPEC.md).
- A request, values, the error a request is rejected with, `INVALID_ARGUMENT`, and an argument and a key left out: [the handle](../DECKIT-7/SPEC.md).
- `QUOTA_EXCEEDED`, which [the storage](../DECKIT-13/SPEC.md) states of a place with no room: here, of an answer over the limit.
- The sites a case serves, the key `sites` of the input `call`, and the look `requested`: [the case format](../DECKIT-1/SPEC.md).
- A web page shown in a session, which sends the same cookies: [web pages](../DECKIT-25/SPEC.md).

## Alternatives considered

- `fetch` taking and answering what a page's own fetch takes and answers, a request and a response object. Neither is a value, as [the handle](../DECKIT-7/SPEC.md) fixes values, so a mod could not hand one to another across a connection, and a case could not read one.
- The body as text. The bytes of an image or an archive would be lost in the decoding; base64 holds every byte, both ways.
- Headers as a table keyed by name. A name an answer repeats, such as `set-cookie`, would keep one value; and an answer's names are not ordered alike by every implementation's HTTP, so a list in the order received would differ between two. One pair a name, in the order of the names, with a repeated name's values joined, is the same everywhere, as HTTP lets a repeated name be read.
- Every redirect followed. A site that redirects to itself would hold a fetch for ever; 20 is the limit the web's own fetch sets.
- A `credentials` option. A fetch through a session is the session's, and sends its cookies as its pages do; a mod that wants none fetches through a session it keeps signed out.
- No limit on an answer. The answer is held whole in the app's process; a limit, refused with a kind of its own, tells the mod why.
- The answer of a page, its scripts run. That is a web page, which shows what a site's scripts do in the session; a fetch is a request.

## Notes

**Note.** Some sentences above are held by no case under `conformance/`, each for its reason. The refusal `ENDED`: no base of [the case format](../DECKIT-1/SPEC.md) ends one lifecycle of a run while another runs, as [the web engine](../DECKIT-23/SPEC.md) says. A method that is none of the six, sent as it is handed: the sites of the case format answer a method HTTP does not register, or one not in upper case, with 400. An answer whose `content-length` is more than the limit: a case's site writes the length of what it holds. A cookie kept 14 days: a case reads no cookie's time, and takes no 14 days. A content coding of `deflate`, and the statuses 101 and 103: no case's site answers them, a site answering 101 and 103 only on the way to another answer. A connection that fails: the case format's sites answer every request; the cases hold `REFUSED` by redirects. Which cookies HTTP's state management sends with a request, past one of the path `/` on one host: that is HTTP's, held by a case of each sent and not sent.

**Note.** What a request carries besides what is handed is not fixed: the headers the session writes itself, such as its host, the length of its body, its cookies, the user agent of its pages, what it accepts, the languages it asks for, and the content type of a body that names none. A site reads them as it reads those of a page shown in the session, and they differ from one implementation's HTTP to another's; a header handed of one of those names may be sent as handed or replaced by the session's.

**Note.** What this costs an implementation: an HTTP request made outside every page, with the session's cookie store read before it and written after each answer, the redirects' among them; the redirects counted and their methods changed as the table says; an answer read as it arrives and stopped past the limit, its headers gathered by name; and the bytes carried in base64 both ways.
