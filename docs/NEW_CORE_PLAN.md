# AgentScore — nowy rdzeń (plan)

> Stan na 2026-11-25, `main` = `5d3403f` (Etap 9d). Ten dokument tylko czyta, mierzy i projektuje:
> **żadnej zmiany w kodzie produktu**. Każde twierdzenie ma w Aneksie B oznaczenie
> **[zweryfikowane: źródło/polecenie]** albo **[założenie]**. Słowa, które mają się pojawić na
> ekranie, są po angielsku (aplikacja jest po angielsku) i w `takiej czcionce`.

## Czego nie udało się sprawdzić (przeczytaj najpierw)

- **Wątki 1265 i 1276 na Atlasie — nie otworzyłem ich.** Forum (`atlas.discourse.group`) jest
  zablokowane dla tej sesji, tak samo archiwum sieci. Znam tylko tytuł wątku 1265 z wyniku
  wyszukiwarki („ARP — the reputation layer i've been building toward"); o 1276 nie wiem nic.
  **Zamiast forum przeczytałem źródło:** repozytorium ARP, w tym dokument pisany dla autora
  adaptera (`docs/34`, z 2026-11-11) i kod, który wylicza atom narzędzia. To jest nowsze i
  dokładniejsze niż post, ale nie wiem, czy w wątkach nie padły ustalenia, których w repo nie ma.
  Wklej mi treść obu wątków albo dopuść ten host, a sprawdzę to w kilka minut.
- **Strony z danymi rynkowymi i incydentami.** Większości hostów nie dało się otworzyć z tej sesji.
  Sam otworzyłem i sprawdziłem: API oficjalnego rejestru MCP, rejestr npm, blog MCP, politykę
  moderacji rejestru, repozytorium ARP i kontrakty Intuition. Reszta (incydenty, katalogi,
  konkurenci) to wyciągi z wyszukiwarki — w Aneksie B mają oznaczenie [założenie] z adresem.
  **Przed publicznym użyciem którejkolwiek z tych liczb otwórz jej stronę.**
- **Jeden adres z listy startowej:** `cursor.com` (host zablokowany dla tej sesji). Pozostałe 18
  adresów „○" sprawdziłem: każde repozytorium odpowiada.
- **Przypinanie w IPFS.** Bramki IPFS i mutacje indeksera były niedostępne. Wiem, że umiem wyliczyć
  identyczny CID i id atomu (sprawdzone na dwóch atomach), ale nie sprawdziłem, czy API przypinania
  Intuition zwróci ten sam CID. Dlatego Etap 10 zaczyna od tego jednego porównania.
- **RPC z briefu.** `rpc.testnet.intuition.systems` nie odpowiada z tej sesji. Użyłem adresu, którego
  używa aplikacja: `testnet.rpc.intuition.systems/http`.
- **Skąd dokładnie biorą się stare pozycje „po obu stronach".** Widzę, że powstały w transakcji
  tworzenia trójki (październik 2025) i że dziś kontrakt takiej wpłaty nie przyjmie na tej samej
  krzywej. Nie czytałem starej wersji kontraktu.
- **Ekrany.** Nic nie klikałem i niczego nie budowałem: sekcje 2 i 3 to projekt, nie zrzuty.
- **Mainnet.** Wszystkie odczyty łańcucha są z testnetu 13579. Liczby ARP dla mainnetu znam tylko
  z ich dokumentu.
- **Jedna rzecz poza zakresem, którą widać w danych:** `/api/v1/stats` na produkcji miało dziś
  `dataAgeSeconds: 6672` (prawie 2 godziny). Pinger z Etapu 9d najpewniej nie jest jeszcze
  ustawiony — to 5 minut, instrukcja jest w `docs/OPS.md`.

---

## 1. Nowy rdzeń w 5 zdaniach

1. **Czym jesteśmy:** AgentScore to miejsce, gdzie przed użyciem agenta AI albo narzędzia MCP
   widzisz, co mówią ludzie, którzy go używali — z imienia, w jakim kontekście i jak stare są te
   dane — a po użyciu sam mówisz, czy zadziałało.
2. **Dla kogo:** dla developera, który ma zaraz wkleić `claude mcp add …` z cudzego README; dla
   buildera narzędzia, który chce dowodu, że ono komuś działa; i dla agenta, który pyta, zanim coś
   zainstaluje, wywoła albo zapłaci.
3. **Dlaczego teraz:** w oficjalnym rejestrze MCP jest dziś 74 270 serwerów, rejestr sam mówi, żeby
   zakładać „minimalną albo żadną moderację", a wszystko, co je dziś ocenia, to gwiazdki, skany
   i raporty agentów — nigdzie nie znalazłem nazwanych ludzi, którzy mówią „u mnie nie zadziałało".
4. **Co zmieniamy:** oceniamy to, czego ludzie naprawdę używają (dowolny adres, ten sam atom co
   ARP), dodajemy drugą stronę („nie zadziałało") i zostawiamy jedną liczbę: ludzi, nie kapitał.
5. **Czego nie zmieniamy:** kręgosłupa tezy — i uczciwie mówimy, że dziś mówi u nas jedna osoba,
   więc pierwszy etap nie buduje funkcji, tylko sprawia, że prośba kampanii („powiedz o tym, czego
   używasz") jest w ogóle wykonalna.

**Trzy rzeczy, które ten plan zmienia, i jedna, której nie rusza:**

| | Dziś | Po zmianie |
|---|---|---|
| **Co oceniamy** | 8 agentów „natywnych" (głównie testy właściciela) + 265 z rejestru ERC-8004 | Wszystko, co ma adres i czego ludzie naprawdę używają: serwer MCP, repo, paczka, skill, agent |
| **Co można powiedzieć** | Tylko „ufam" | „Zadziałało" albo „nie zadziałało" — dwie strony tej samej trójki |
| **Jedna liczba** | Dwie: ludzie (karta) i kapitał (`trustScore`, `topAgent`) | Ludzie po każdej stronie, w kontekście. Kapitał zostaje w API jako „backing", bez pierwszego planu |
| **Kręgosłup tezy** | — | Bez zmian: liczą się różni ludzie, nigdy kapitał; jeden portfel niczego nie podnosi; imiona, kontekst i wiek danych zawsze widać; nieudany odczyt to nie dane; bramka zamyka się na „nie"; decyzji nie da się kupić |

**Najważniejsze odkrycie rekonesansu.** ARP (projekt wieedze) od 28 października tworzy na testnecie
atomy narzędzi według przepisu, w którym **id atomu jest czystą funkcją adresu URL**. Odtworzyłem
ten przepis w 20 liniach i wynik zgadza się z atomami w łańcuchu. To znaczy, że „dodaj cokolwiek po
adresie" nie wymaga wymyślania niczego: liczymy id z adresu, czytamy atom, jeśli istnieje, a jeśli
nie — tworzy go pierwsza osoba, która coś powie, i ląduje dokładnie tam, gdzie wylądowałby ARP.
Na testnecie jest już **770 takich atomów** (94 narzędzia i repozytoria, 676 skilli).

**Druga rzecz, którą trzeba powiedzieć wprost.** Po tej zmianie AgentScore i ARP odpowiadają prawie
na to samo pytanie („sprawdź, zanim Twój agent zainstaluje albo zapłaci" — to dosłownie hasło z
README ARP). Różnica jest jedna i wystarczająca: ARP zapisuje, co raportują **agenci** (klucz
wygenerowany na maszynie, słowa `worked` / `failed`), a AgentScore — co mówią **nazwani ludzie**,
z bramką, która odmawia. To dwa rodzaje sygnału na tym samym atomie, nie dwa konkurencyjne
rejestry. Plan zakłada współpracę, nie wyścig (sekcja 5 i Appendix A).

---

## 2. Trzy podróże, krok po kroku

### A. Osoba sprawdza narzędzie, używa go, mówi, czy zadziałało

| Krok | Co robi | Co widzi (dokładne słowa) |
|---|---|---|
| 1 | Ma zainstalować serwer MCP z README. Otwiera `/check`. | Nagłówek: `Before you use it, see who says it worked.` Pole: `Paste what you're about to use: a GitHub repo, an MCP server URL, an npm package…` |
| 2 | Wkleja `https://github.com/makenotion/notion-mcp-server`. | Strona pozycji (ekran 1 w sekcji 3): `github.com/makenotion/notion-mcp-server` · `MCP server` · `3 people say it worked · 1 says it didn't` · chip `Verified` · `Read 2 min ago` |
| 3 | Patrzy, kto i za co. | `Worked for AI / Coding — 3 people` z imionami (ENS albo skrót portfela) i datami. `Didn't work for AI / Coding — 1 person`. Osobna linia: `Agents report (ARP): 5 worked · 2 failed`. Na dole: `AgentScore is not affiliated with this project. This page shows what people who used it say.` |
| 4 | Instaluje, używa. | — |
| 5 | Wraca: z zakładki, ze znaczka w README albo z linku, który podał jej agent (`sayUrl`). | `Did it work for you?` · `[It worked]` `[It didn't work]` |
| 6 | Klika `It worked`. | `For what?` — 8 kontekstów (ten z linku zaznaczony). Pole wyboru, wymagane: `I've used this myself.` Linia kosztu jak dziś: `0.04 tTRUST behind it · fee 0.001 tTRUST · total 0.041 tTRUST, plus gas`. Przycisk: `Say it worked for AI / Coding` |
| 7 | Podpisuje. | `You said it worked for AI / Coding.` · `Now: 4 people say it worked · 1 says it didn't · read just now` · `Changed your mind? You can take it back at any time.` |

Jeśli w kroku 2 nikt jeszcze nic nie powiedział: `Nobody has said anything about this yet. That is
not a yes and not a no.` · `Used it? Be the first to say whether it worked.` Bez zera na pierwszym
planie.

### B. Builder narzędzia bierze znaczek i przyprowadza użytkowników

| Krok | Co robi | Co widzi |
|---|---|---|
| 1 | Na `/check` klika `Built it? Get its link.` i wkleja adres swojego repo. | Karta jego narzędzia — istnieje od razu, bez transakcji i bez rejestracji, bo adres wystarcza do wyliczenia atomu. |
| 2 | Kopiuje link. | `Send this to 3 people who used it.` · `…/check?q=github.com/you/tool&for=ai-coding` · `Two people make it Established. Three make it Verified.` |
| 3 | Wkleja znaczek do README. | Przy zerze znaczek nie pokazuje zera, tylko zaproszenie: `AgentScore · Used it? Say if it worked`. Od pierwszej osoby: `AgentScore · 3 worked · 0 didn't · as of 2026-12-02 18:40 UTC` |
| 4 | Użytkownicy klikają link. | Podróż A od kroku 5, z kontekstem z linku. |
| 5 | Ktoś mówi „nie zadziałało". | Builder tego nie usunie i nie przykryje. Widzi **kto** i **w jakim kontekście**, więc może naprawić i poprosić tę osobę o cofnięcie. Na karcie: `1 person says it didn't work for AI / Coding`. |

### C. Agent pyta przed wywołaniem albo instalacją

| Krok | Co się dzieje | Odpowiedź |
|---|---|---|
| 1 | Użytkownik w Claude Code: „dodaj serwer MCP do Notion". Agent, zanim wykona `claude mcp add`, woła nasze `should_i_trust` z adresem `github.com/makenotion/notion-mcp-server`. | — |
| 2 | Są dane. | `decision: "allow"`, `summary: "3 named people say it worked for AI / Coding; 1 says it didn't. Nobody reported it as harmful. Read 2 min ago."`, `signal: "worked"`, `people: [...]`, `usage: { source: "arp", worked: 5, failed: 2 }` |
| 3 | Sporne. | `decision: "deny"`, `signal: "disputed"`, `summary: "Disputed: 2 named people say it didn't work for AI / Coding, 3 say it worked. Ask the user before installing."` |
| 4 | Nikt nic nie powiedział. | `decision: "deny"` (polityka niespełniona, jak dziś), ale `signal: "none"` i `summary: "Nobody has said anything about this on AgentScore. That is not a yes and not a no."` — agent mówi to użytkownikowi i **nie** traktuje tego jak ostrzeżenia. |
| 5 | Nie udało się odczytać. | `decision: "unknown"`, `signal: "unknown"` — jak dziś: to nie jest „tak". |
| 6 | Po sesji agent podaje człowiekowi link. | `sayUrl: "…/check?q=github.com/makenotion/notion-mcp-server&say=1"` — `You used this in this session. Did it work? Say it under your own name.` Agent **nie** mówi za człowieka: jego własny raport idzie do ARP (linia maszynowa), nie do liczby ludzi. |

### Słowa: jedno odstępstwo od Etapu 8a, do decyzji właściciela

Dokumentacja Intuition nazywa obie strony wprost: „Users can stake either FOR or AGAINST a
statement", „Positive Vault" / „Negative Vault". Druga strona to więc język protokołu, nie nasz
wymysł. Etap 8a ustalił jeden czasownik: ludzie *trust* agenta za *trust context*. Zostają: `trust context`
jako „za co", nazwy szczebli (`Unverified` · `Established` · `Verified`), blok `Your trust`, nazwy
pól w API. Zmienia się pytanie i licznik: `It worked` / `It didn't work`, `3 people say it worked ·
1 says it didn't`. Powód: „trust" nie ma uczciwej drugiej strony. „Distrust" oskarża; „didn't
work" opisuje, co się stało. Jeśli właściciel woli trzymać się 8a co do litery, wariant zapasowy to
`3 people trust it · 1 says it didn't work` — strona dodatnia mówi językiem Intuition, ujemna
prostym. Reszta planu od tego wyboru nie zależy.

---

## 3. Trzy ekrany (makiety tekstowe)

### Ekran 1 — strona pozycji, obie strony

```
┌──────────────────────────────────────────────────────────────────────────┐
│ github.com/makenotion/notion-mcp-server            [MCP server · GitHub]  │
│ ↗ open on GitHub                                                          │
│                                                                           │
│  3 people say it worked  ·  1 says it didn't            [ Verified ]  (?) │
│  ● ● ●                                                                    │
│                                                                           │
│  Did it work for you?      [ It worked ]   [ It didn't work ]             │
│                                                                           │
│ ── WORKED ─────────────────────────────────────────────────────────────── │
│  AI / Coding              3 people                                        │
│    kryptoremontier.eth    since 2026-12-01                                │
│    zet.box                since 2026-12-02                                │
│    0x56BC…ec42            since 2026-12-02                                │
│  Knowledge / Productivity 1 person                                        │
│    zet.box                since 2026-12-03                                │
│                                                                           │
│ ── DIDN'T WORK ────────────────────────────────────────────────────────── │
│  AI / Coding              1 person                                        │
│    0xF3c0…4109            since 2026-12-04                                │
│                                                                           │
│ ── REPORTS ────────────────────────────────────────────────────────────── │
│  Nobody reported it as harmful.                                           │
│                                                                           │
│ ── AGENTS (not counted above) ─────────────────────────────────────────── │
│  Agents report (ARP): 5 worked · 2 failed · most common reason: missing-key│
│  Used by 4 agents                                                         │
│                                                                           │
│  Read 2 min ago                                    Details ▸ (backing)    │
│  AgentScore is not affiliated with this project.                          │
│  This page shows what people who used it say.                             │
└──────────────────────────────────────────────────────────────────────────┘
```

Stany chipa: `Unverified` · `Established` · `Verified` · `Disputed` (nowy, sekcja 4). Stan sporny:
`3 people say it worked · 2 say it didn't` + chip `Disputed` + jedno zdanie pod „?":
`Disputed: at least 2 people, and at least one in three of everyone who spoke, say it didn't work.`

### Ekran 2 — dodawanie po adresie

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Before you use it, see who says it worked.                                │
│ ┌──────────────────────────────────────────────────────────┐  [ Check ]  │
│ │ github.com/acme/weather-mcp                              │             │
│ └──────────────────────────────────────────────────────────┘             │
│ A GitHub repo, an MCP server URL, an npm or PyPI package, a website,      │
│ an ERC-8004 id, or a name.                                                │
│                                                                           │
│ We read this as:   github.com/acme/weather-mcp      [GitHub repository]   │
│                                                                           │
│ Nobody has said anything about this yet.                                  │
│ That is not a yes and not a no.                                           │
│                                                                           │
│ Used it?   [ It worked ]   [ It didn't work ]                             │
│ You'd be the first. This also puts it on the list (one extra signature,   │
│ 0.001 tTRUST).                                                            │
│                                                                           │
│ Built it?  Get its link ▸                                                 │
└──────────────────────────────────────────────────────────────────────────┘
```

Błędy mówią, co zrobić: `We can't read "notion mcp" as an address. Paste a link, or search by name.`
Adres, którego nie umiemy sprawdzić (np. repo nie istnieje): `GitHub says there is no repository at
github.com/acme/weather-mpc. Check the spelling.` — nie tworzymy atomów dla literówek.

### Ekran 3 — profil osoby

```
┌──────────────────────────────────────────────────────────────────────────┐
│ zet.box                                         on Intuition since 2025-10 │
│ 0xF3c0…4109                                                               │
│                                                                           │
│  Spoke about 7 tools and agents · 6 worked · 1 didn't                     │
│                                                                           │
│ ── WHAT THEY SAID ─────────────────────────────────────────────────────── │
│  worked        github.com/makenotion/notion-mcp-server   AI / Coding   12-02│
│  worked        github.com/supabase/mcp                   AI / Coding   12-02│
│  didn't work   github.com/acme/weather-mcp               AI / Coding   12-04│
│  …                                                                         │
│                                                                           │
│ ── HOW IT HELD UP ─────────────────────────────────────────────────────── │
│  3 times, 2 or more people later said the same                            │
│      AI / Coding 2 · Crypto / Onchain 1                                   │
│  1 time, 2 or more people later said the opposite                         │
│      AI / Coding 1                                                        │
│  3 are still theirs alone                                                 │
│                                                                           │
│  This is a record, not a rank. Nothing is paid for it and it changes      │
│  nothing in a tool's tier.                                                │
└──────────────────────────────────────────────────────────────────────────┘
```

Własny profil ma dodatkowo blok `Your trust` z Etapu 9c (teraz dla obu stron: `Take it back`).

---

## 4. Poprawki do tezy

Teza jest po angielsku, więc tekst poprawek też. Każda ma powód i to, co pęka bez niej. Zatwierdza
właściciel; dopóki tego nie zrobi, teza v1.1 obowiązuje bez zmian.

### P1 — §1: pytanie obejmuje narzędzia, nie tylko agentów

Zastąpić pogrubione pytanie:

> **"Before I use this agent or tool: who says it worked, for what — and how do I know?"**
>
> An *item* is anything a person or an agent can use and name by its address: an AI agent, an MCP
> server, a skill, a package, a repository, a site. Wherever this document says "agent", read
> "item", unless it says otherwise.

**Powód:** ludzie mogą uczciwie mówić tylko o tym, czego użyli, a 273 pozycji z dzisiejszej listy
prawie nikt nie zna. **Bez tego:** kampania prosi ludzi o coś, czego nie mogą zrobić uczciwie.

### P2 — §4: jednostka danych ma dwie strony

Zastąpić blok jednostki i regułę (4), dodać (6) i (7):

> ```
> TRIPLE:    [item] — is skilled in — [canonical context]
> FOR      (the triple's vault):    "it worked for me, for this context"
> AGAINST  (its counter-vault):     "it didn't work for me, for this context"
> EACH POSITION HAS A WALLET → that wallet IS the person speaking
> ```
>
> (4) The negative side of a claim is its counter-vault: a person who used the item and for whom
> it did not work. `reported for` + the safety taxonomy stays for a different statement — "this is
> harmful" — and is shown on its own line, never mixed into either count.
>
> (6) One wallet, one side. Per context, a wallet counts on the side where it holds shares. A
> wallet with live shares on both sides of one triple counts on neither.
>
> (7) Speak about what you used. The app asks every person to confirm they used the item before
> they sign. It cannot prove use, and never claims that it did.

**Powód:** dziś istnieje tylko „tak", więc to lista poparć, nie reputacja. Strona przeciwna jest
w protokole od początku (każda trójka ma `counter_term_id`) i na naszych trójkach nikt jej nie
użył: 0 z 75. **Bez tego:** bramka przepuści narzędzie, o którym pięć osób wie, że nie działa.

### P3 — §6: tier czyta obie strony; stan „Disputed"

Dopisać do akapitu „Agent tiers":

> Both sides. People for: distinct wallets with live shares on an item's attestation triples.
> People against: distinct wallets with live shares on their counter-vaults. **Disputed**: at
> least 2 people against, at least 0.05 tTRUST behind them, and at least one in three of everyone
> who spoke. A Disputed item is never Established or Verified: in the API its `tier` is
> `unverified` with `disputed: true`; on screen it reads Disputed. Otherwise the ladder is
> unchanged. A single wallet can never lift an item above Unverified and can never make it
> Disputed. Past the dust floor, amounts decide nothing: 1 tTRUST and 0.04 tTRUST are one person.

**Powód:** druga strona musi coś znaczyć dla maszyny, a nie tylko dla oka. **Bez tego:** „nie
zadziałało" jest ozdobą.

### P4 — §6: jedna liczba

Nowy akapit w §6:

> One headline. Wherever AgentScore shows or returns one number about an item, it is people: how
> many say it worked, how many say it didn't, for which context. Capital on an item's own vault is
> *backing*: kept in the API under its existing field names (`trustScore`, `qualityScore`,
> `objectScore`, `agentScore`), documented as backing, never a headline, never a ranking key,
> never an input to the tier or the gate.

**Powód:** dziś `/api/v1/stats` ogłasza `topAgent: OPEN CLAW, trustScore 98` (jeden staker, obiekt
testowy), a karta tego samego agenta mówi „Unverified". Jedyny agent, któremu ktoś ufa (Luda), ma
`trustScore 50`. **Bez tego:** nazwa „AgentScore" obiecuje wynik, a są dwa i sobie przeczą.

### P5 — §9 i §3: ARP to ten sam atom, inny sygnał

Zastąpić w §9 „No flat-reputation race with ARP (…)":

> No race with ARP: one atom per tool, two kinds of signal. AgentScore derives an item's atom from
> its address exactly as ARP does (normalised URL → schema.org Thing → CID), so both write to the
> same atom. ARP's lines are what agents report per use. AgentScore's are what named people say.
> Machine signals are shown on their own line and never enter the people count, the tier, or the
> gate's default.

W §3 usunąć zdanie „ARP has a staking fragment of L2" (nieaktualne: ARP nie czyta kwot depozytów).

**Powód:** dwa projekty w jednym ekosystemie, ten sam przedmiot. **Bez tego:** powstają dwa atomy na
jedno narzędzie i nikt ich już nie połączy (Intuition nie ma usuwania).

### P6 — §6: zapis osoby to zapis, nie ranking

Nowy akapit w §6:

> A person's record. A profile may show how often others later said the same, or the opposite, as
> this person (2 or more other people, on the same item and context, after them). It is shown as
> counts with dates, agreements and disagreements together. It is never a rank, a weight, a
> reward, or an input to the tier or the gate.

**Powód:** osoba, która coś mówi, nie dostaje dziś nic. **Bez tego:** albo dalej nic nie dostaje,
albo budujemy ranking, który płaci za decyzje — a tego teza zabrania.

### Nowe zdanie tezy (§11)

> **AgentScore is where you see, before you use an AI agent or a tool, what the named people who
> used it say and for what — and where you say, after you use it, whether it worked. Every word
> has a name, a context and an age; only distinct people count, never capital; and an agent that
> asks gets a yes, a no, or an honest "I can't read that".**

---

## 5. Model danych

### 5.1 Atom pozycji: liczony z adresu (przepis ARP, bez zmian)

Przepis ARP (`packages/protocol/src/declare/tool-thing.ts`, `thing-cid.ts`), przepisany dosłownie:

1. **Normalizacja URL** (`normaliseToolUrl`): brak schematu → `https://`; schemat zawsze `https`;
   `www.` znika; porty `:80` i `:443` znikają; kropka na końcu hosta znika; `.git` i `/` na końcu
   ścieżki znikają; fragment (`#…`) znika; klucze zapytania są sortowane. **Wielkość liter w ścieżce
   zostaje.**
2. **Dokument Thing**: `name` = URL bez `https://`; `url` = pełny znormalizowany URL; `image` =
   `""`; `description` = stałe zdanie `A tool identified by its URL, so every declaration of its
   use lands on one atom.`
3. **Bajty**: `JSON.stringify` z kluczami w kolejności `@context`, `@type`, `description`, `image`,
   `name`, `url`, bez spacji.
4. **Dane atomu**: `ipfs://` + CIDv1 (kodek raw, sha2-256, base32) z tych bajtów.
5. **Id atomu**: to, co zwraca MultiVault `calculateAtomId` dla tych danych.

Sprawdzone na dwóch atomach z testnetu. Dla „brudnego" wejścia
`http://www.github.com/SonarSource/sonarqube-mcp-server.git` wynik to atom `0x2617a53f…`, który ARP
utworzył 28 października.

**Reguła zapisu:** nigdy nie tworzymy atomu inaczej niż tym przepisem. **Reguła odczytu:** liczymy id
z adresu i pytamy o ten jeden atom. Szukanie po nazwie zostaje tylko do składania starych
duplikatów (5.3), nigdy do zwykłego odczytu.

**Jedyna rzecz do potwierdzenia w Etapie 10:** żeby indekser pokazywał `value.thing`, dokument musi
być przypięty w IPFS. Przypinamy przez API Intuition i **porównujemy zwrócony URI z wyliczonym**;
jeśli się różnią, zatrzymujemy się i nie tworzymy atomu. To samo każe oficjalny przewodnik
Intuition: „Pin first and compare the returned URI to the canonical atom's `data` field before
minting." Ryzyko jest konkretne: ten sam przewodnik mówi, że `pinThing` wymaga wszystkich czterech
pól, a atom ARP ma `image: ""`.

**Dwie konwencje Intuition, które się różnią.** Repozytorium `intuition-data-structures` zaleca dla
oprogramowania atom typu `SoftwareSourceCode` z polami `name` i `codeRepository`, bez opisu i
obrazka. Przewodnik ERC-8004 i wszystko, co dziś powstaje na testnecie, używa przypiętego `Thing`
z czterema polami. Nie znalazłem zdania, które to godzi. Wybieram `Thing` według przepisu ARP z
jednego powodu: tak wygląda 770 atomów, które już istnieją, a Intuition nie ma usuwania. Pytanie
o docelowy kształt idzie do zespołu Intuition (Appendix A) przed mainnetem.

### 5.2 Jakie adresy przyjmujemy

| Co wkleja człowiek | Adres (= etykieta atomu) | Jak sprawdzamy, że istnieje |
|---|---|---|
| Repo GitHub | `github.com/<owner>/<repo>` | `api.github.com/repos/…` (stały host) |
| Skill w repo | `github.com/<owner>/<repo>?skill=<name>` (forma ARP) | jak repo |
| Paczka npm | `npmjs.com/package/<name>` (także `@scope/name`) | `registry.npmjs.org/<name>` |
| Paczka PyPI | `pypi.org/project/<name>` | `pypi.org/pypi/<name>/json` |
| Obraz Docker | `hub.docker.com/r/<org>/<image>` | bez pobierania |
| Zdalny serwer MCP | host + ścieżka, np. `mcp.stripe.com`, `mcp.neon.tech/mcp` | bez pobierania; tylko `https` |
| Strona | host (+ ścieżka), np. `cursor.com` | bez pobierania |
| Konto X | `x.com/<handle>` | bez pobierania |
| Id ERC-8004 | dzisiejszy resolver (`8453:1380`, forma CAIP) → atom z kohorty | jak dziś |
| Nazwa | dzisiejsze wyszukiwanie po nazwie | jak dziś |

Serwer pobiera tylko ze **stałych hostów** (GitHub, npm, PyPI). Dowolnych adresów użytkownika nie
pobiera nigdy — to zamyka klasę ataków, w której formularz służy do skanowania sieci.

Rodzaj pozycji (`MCP server`, `GitHub repository`, `npm package`…) wynika z adresu. Deklaracje
innych (`has type → MCP Server` — 72 trójki na testnecie, `has tag → mcp`) czytamy jako deklaracje,
zgodnie z podziałem z tezy §7: *deklarowane* to nie *poświadczone*.

### 5.3 Składanie duplikatów (`atom-fold`)

Zapis nie tworzy duplikatów, ale stare już istnieją. Trzy klasy i jedna reguła na każdą:

| Klasa | Przykład z testnetu | Reguła |
|---|---|---|
| Inna wielkość liter | `github.com/WyattBlue/…` vs `github.com/wyattblue/…` (13 atomów ARP ma wielkie litery) | Składamy po etykiecie sprowadzonej do małych liter — dokładnie to robi dziś `foldDuplicateAtoms`. Przed utworzeniem nowego atomu szukamy wariantu i go używamy. |
| Stary atom innego kształtu | `TextObject` z etykietą `https://github.com/intuition-box/ARP` (2 sztuki) | Składamy tylko wtedy, gdy jego URL po normalizacji daje ten sam adres. Nigdy po nazwie wyświetlanej. |
| To samo narzędzie pod innym adresem | `hub.docker.com/r/sonarsource/sonarqube-mcp` → `source` → repo GitHub | **Nie** składamy. Pokazujemy `Same tool: …` z krawędzi `source`, którą trzyma portfel atestora ARP. Decyzja o sumowaniu — po rozmowie z wieedze. |

Reprezentant grupy: atom z przepisu ARP; ludzie z całej grupy są sumowani **po portfelu** (jedna
osoba to jedna osoba, na ilu atomach by nie stała).

### 5.4 Trójka i obie strony — co jest w łańcuchu

- Każda trójka ma stronę przeciwną: `getCounterIdFromTripleId` na kontrakcie, `counter_term_id`
  w Hasurze. Hasura daje też `counter_positions` i `triple_term { supporter_count, opposer_count }`.
  Sprawdzone na trójce Luda — Knowledge / Productivity.
- **Jeden portfel nie może dziś stanąć po obu stronach na tej samej krzywej.** Symulacja wpłaty „przeciw" z portfela, który
  trzyma „za", kończy się `MultiVault_HasCounterStake` — także wsadowo, także dla świeżego portfela,
  który próbuje obu stron w jednej transakcji.
- **Blokada jest na krzywą, nie na trójkę.** Komentarz w kontrakcie (`MultiVaultLib._hasCounterStake`):
  „Counter-stake is scoped per curve… Holding opposing sides on different curves is allowed". My
  używamy tylko krzywej 1, ale czytnik musi patrzeć na wszystkie krzywe naraz.
- **Stare wiersze „po obu stronach" istnieją:** w 4 z 40 sprawdzonych trójek ten sam portfel ma
  żywe udziały po obu stronach. Jedną prześledziłem do końca: obie pozycje powstały w transakcji
  tworzenia trójki 2025-10-22. Z obu powodów reguła (6) z P2: portfel z udziałami po obu stronach
  jednej trójki, na dowolnych krzywych, nie liczy się po żadnej.
- Zmiana zdania = wycofanie jednej strony, potem wpłata na drugą. Dwa podpisy.
- Domyślna kwota 0,04 tTRUST działa tak samo po stronie „przeciw": symulacja daje 0,0396 udziału,
  jak po stronie „za". Dwie domyślne wypowiedzi „nie zadziałało" to 0,0792 ≥ 0,05, więc próg
  „Disputed" jest lustrzanym odbiciem „Established". Logika Etapu 9b zostaje nienaruszona.
- Koszt pierwszej wypowiedzi o nowym narzędziu na testnecie: atom 0,001 + trójka 0,001 + 0,04 +
  2,5% opłaty FeeProxy (stała opłata to dziś 0) ≈ **0,043 tTRUST**. Kolejne osoby: ≈ 0,041.

### 5.5 Reguła liczenia (do kodu, słowo w słowo)

Dla pozycji *I* i każdej jej trójki `T = (I, is skilled in, kontekst)` z kontr-trójką `C`:

1. `za(T)` = portfele z żywymi udziałami na `T`; `przeciw(T)` = portfele z żywymi udziałami na `C`.
2. Portfel obecny w obu zbiorach dla tej samej trójki wypada z obu (i jest pokazany jako
   `on both sides — not counted`).
3. `peopleFor(I)` = liczba różnych portfeli w sumie wszystkich `za(T)`; `peopleAgainst(I)` —
   analogicznie. Osoba, która mówi „zadziałało do kodu" i „nie zadziałało do krypto", liczy się raz
   po każdej stronie: to prawdziwa, zniuansowana opinia.
4. `disputed(I)` = `peopleAgainst ≥ 2` **i** `againstWei ≥ 0,05` **i** `3 × peopleAgainst ≥
   peopleFor + peopleAgainst`.
5. Tier: jeśli `disputed` → `unverified` (+ `disputed: true`); inaczej drabina jak dziś.
6. To samo, zawężone do jednego kontekstu, dla polityk bramki z `area`.

Przykłady: 3 za / 2 przeciw → sporne (2 z 5). 10 za / 2 przeciw → nie sporne, ale obie liczby
widać. 1 za / 1 przeciw → `Unverified`, nie sporne (jedna osoba po żadnej stronie nie wystarcza na nic).

**Bramka:** nowe pokrętło `maxPeopleAgainst` (liczba ≥ 0), łączy się z `minTier` albo `minPeople`.
Gdy pytający go nie poda, bramka **odmawia pozycji spornej** — to jest domyślne zamknięcie na „nie".
Dziś nie zmienia to niczyjej decyzji, bo na naszych trójkach nie ma ani jednej pozycji „przeciw".

**Uczciwie o sybilach:** „Disputed" kosztuje 2 jednorazowe portfele — tę samą klasę kosztu co
„Verified" (3 portfele). To nie jest nowa dziura, tylko ta sama, znana z przeglądu z listopada.
Obrony też te same i dotyczą obu stron: pokazać, kim są ludzie; liczyć pozycję po 7 dniach
(Etap 15).

### 5.6 Współistnienie z ARP

| | ARP | AgentScore |
|---|---|---|
| Kto mówi | Agent (klucz utworzony na maszynie użytkownika, `~/.arp/agent-key`) | Człowiek, własnym portfelem, pod imieniem |
| Zapis | `(agent, uses, narzędzie)` → `in context of` → `has outcome` → `worked` / `failed` → `because` → powód z zamkniętej listy | `(narzędzie, is skilled in, kontekst)`: depozyt „za" albo „przeciw" |
| Atom narzędzia | wyliczony z URL | **ten sam** |
| Konteksty | drzewo domen na OASF (węzły-napisy) | 8 kubełków mapowanych na OASF (teza §7) |
| Kwoty | nie czyta | nie czyta (poza progiem pyłu) |
| Wynik | brak globalnego; brak werdyktu | tier + bramka pod polityką pytającego |
| Stan na testnecie | 14 wyników (7 `worked`, 7 `failed`), wszystkie utworzone przez portfele ARP; ich własny dokument: „No third party has written a line" | 1 osoba, 3 żywe pozycje |

Co czytamy od ARP (Etap 13): linie `has outcome` zawieszone na `uses`, których obiektem jest nasza
pozycja (zapytanie 1 z ich dokumentu `docs/34`). Pokazujemy jako `Agents report (ARP): N worked · M
failed`. Nigdy w liczbie ludzi, nigdy w tierze, nigdy w domyślnej decyzji bramki.

Czego potrzebujemy od wieedze (trzy pytania, Appendix A): czy hak ARP po sesji może pokazać
człowiekowi nasz link („powiedz to pod własnym imieniem"); jak traktować `source` między adresami
tego samego narzędzia; czy ich adapter będzie czytał nasze pozycje jako sygnał ludzki.

**Zastrzeżenie semantyczne.** `is skilled in` na testnecie opisuje głównie ludzi („0xvital.eth is
skilled in TypeScript": 71 z 75 trójek ma podmiot-konto). Dla narzędzia brzmi to nieco sztucznie.
Zostaję przy nim, bo teza zakazuje bicia nowego predykatu (mina 2), a czytnik, tier i bramka już
na nim stoją. Pytanie o lepszy predykat kanoniczny idzie do zespołu Intuition **przed** mainnetem.

### 5.7 Lista startowa (propozycja: 45 pozycji)

● = atom już istnieje na testnecie (utworzył go ARP). ○ = repozytorium istnieje (sprawdzone dziś),
atomu jeszcze nie ma: utworzy go pierwsza osoba, która coś powie.

**Serwery MCP (26)**
● `github.com/makenotion/notion-mcp-server` · ● `github.com/stripe/agent-toolkit` ·
● `github.com/supabase/mcp` · ● `github.com/cloudflare/mcp-server-cloudflare` ·
● `github.com/atlassian/atlassian-mcp-server` · ● `github.com/neondatabase/mcp-server-neon` ·
● `github.com/hashicorp/terraform-mcp-server` · ● `github.com/grafana/mcp-grafana` ·
● `github.com/browserbase/mcp-server-browserbase` · ● `github.com/apify/apify-mcp-server` ·
● `github.com/postmanlabs/postman-mcp-server` · ● `github.com/SonarSource/sonarqube-mcp-server` ·
● `github.com/alchemyplatform/alchemy-mcp-server` · ● `github.com/paypal/paypal-mcp-server` ·
● `github.com/zapier/zapier-mcp` · ● `github.com/webflow/mcp-server` · ● `github.com/prisma/mcp` ·
● `github.com/microsoft/mcp` · ● `github.com/mondaycom/mcp` · ● `github.com/figma/mcp-server-guide` ·
○ `github.com/modelcontextprotocol/servers` · ○ `github.com/github/github-mcp-server` ·
○ `github.com/microsoft/playwright-mcp` · ○ `github.com/upstash/context7` ·
○ `github.com/getsentry/sentry-mcp` · ○ `github.com/0xIntuition/intuition-mcp-server`

**Skille i wtyczki (5)**
● `github.com/anthropics/skills` · ● `github.com/obra/superpowers` ·
● `github.com/vercel-labs/agent-skills` · ● `github.com/vercel-labs/agent-browser` ·
● `github.com/mattpocock/skills`

**Agenci do kodu (7)**
○ `github.com/anthropics/claude-code` · ○ `github.com/openai/codex` ·
○ `github.com/google-gemini/gemini-cli` · ○ `cursor.com` · ○ `github.com/cline/cline` ·
○ `github.com/Aider-AI/aider` · ○ `github.com/sst/opencode`

**Frameworki i krypto (6)**
○ `github.com/elizaOS/eliza` · ○ `github.com/coinbase/agentkit` · ○ `github.com/coinbase/x402` ·
○ `github.com/langchain-ai/langgraph` · ○ `github.com/crewAIInc/crewAI` · ○ `github.com/vercel/ai`

**Ekosystem Intuition (1)**
● `github.com/intuition-box/ARP` · Luda i Captain Dackie zostają tam, gdzie są.

Zasady listy: tylko rzeczy, których ktoś ze społeczności mógł realnie użyć w tym miesiącu; żadnej
pozycji właściciela na górze; przy każdej stała linia `AgentScore is not affiliated with this
project.` Lista to plik w repo, nie transakcje: pozycja z listy, o której nikt nic nie powiedział,
nie ma atomu i nic nie kosztuje.

**Co z dzisiejszą listą.** Trzy sekcje, w tej kolejności: `People have spoken` (cokolwiek z
wypowiedzią) → `Tools people use` (lista startowa) → zwinięte `Registry agents — nobody has spoken
yet (265)`.

**Czy „Skills" ma zostać „Tools / MCP"?** Nie. Dzisiejsze atomy Skills to 8 wolnych napisów
(„A developer", „watch", „Real estate agent"), z których jeden ma jakikolwiek depozyt. To nie są
narzędzia i nie mają adresów. Sekcję zamrażamy, a `/skills` przekierowuje na nową listę z filtrem
`kind=tool` (sekcja 8).

---

## 6. Jedna liczba — migracja

**Zasada:** nagłówkiem wszędzie są ludzie po każdej stronie, w kontekście. Żadne pole nie znika.

| Pole / miejsce | Dziś | Po migracji |
|---|---|---|
| `score.trustScore`, `score.qualityScore`, `score.objectScore`, `agentScore` | „AGENTSCORE", opisywane jako wynik | Zostają, te same nazwy i wartości. Dokumentacja i opisy narzędzi MCP nazywają je **backing score**: kapitał na własnym skarbcu pozycji. Nowe pole obok: `score.kind: "backing"`. |
| Każdy obiekt agenta / pozycji (REST, MCP) | `attesters`, `tier` | Dochodzą: `people: { for, against }`, `disputed`, `areas[].peopleAgainst`. Istniejące pola bez zmian. |
| `/api/v1/stats` → `topAgent` | `{ name, trustScore }`, wybierany po kapitale | Zostaje, z dopiskiem `basis: "backing"` i oznaczeniem *deprecated* w dokumentacji. **Nowe:** `mostTrusted: { id, name, peopleFor, peopleAgainst, tier }`, wybierane po ludziach; `null`, gdy nikt nic nie powiedział. Żaden ekran nie pokazuje już `topAgent`. |
| `/api/v1/stats` | `agents`, `attesters`, `agentsEstablished`… | Dochodzą: `items`, `itemsWithPeople`, `peopleAgainst`, `itemsDisputed`. North Star bez zmian: `agentsEstablished + agentsVerified` (teraz obejmuje narzędzia). |
| `/api/v1/agents` — domyślne sortowanie | po `agentScore` | po `peopleFor`, potem `peopleAgainst` rosnąco; `?sort=backing` daje stare zachowanie. To zmiana kolejności, nie pól. |
| MCP `search_agents`, `compare_agents` | ranking po wyniku | ranking po ludziach; backing w odpowiedzi jako pole opisane wprost. |
| Karta, modal, profil | „BACKING 50" pod `Details` (od Etapu 9) | Bez zmian — już zdegradowane. |
| Wzór `trustScore × 0,60 + composite × 0,40` | sekcja „Scoring model" w `CLAUDE.md` | Wzór zostaje w kodzie. Sekcja zmienia tytuł na „Backing score (legacy, API only)", a nad nią staje nowa: „The headline: people per side, per context". |

**Testy do zmiany:** testy statystyk (`topAgent`), `agent-compare`, opisy narzędzi MCP, test
`llms.txt`, `people-copy`. **Dokumenty:** `CLAUDE.md` (słownik punktacji), `docs/TRUST_SCORE_MODEL.md`
i `docs/TRUST_SCORING.md` → `docs/archive/`, `llms.txt`, `/docs`, `SKILL.md`, README.

**Nazwa „AgentScore" zostaje.** Wynikiem jest liczba ludzi. Jedno zdanie na `/docs`: `The score is
people: how many say it worked, how many say it didn't, and for what.`

---

## 7. Dowody użyteczności

Oznaczenia w tej sekcji: **✓** = sprawdziłem sam, dziś, na źródle. **≈** = wyciąg z wyszukiwarki
albo strona otwarta przez agenta pomocniczego, nie przeze mnie (w Aneksie B jako [założenie]).

### 7.1 Rynek w liczbach

| Fakt | Liczba | |
|---|---|---|
| Serwery w oficjalnym rejestrze MCP | **74 270** (z czego 50 276 deklaruje zdalny adres) — pełne przejście API 2026-11-25 | ✓ |
| Pobrania SDK MCP (npm `@modelcontextprotocol/sdk`) | **93,2 mln tygodniowo**, 380 mln miesięcznie, 87 188 paczek zależnych | ✓ |
| Wszystkie SDK MCP łącznie | „just crossed 5 billion total downloads", z czego ponad 4,5 mld w ostatnim roku (blog MCP, 2026-11-24) | ✓ |
| Moderacja rejestru | „consumers should assume minimal-to-no moderation"; rejestr **nie** usuwa serwerów słabych, zepsutych ani z lukami bezpieczeństwa | ✓ |
| Ile serwerów z rejestru w ogóle się uruchamia | 427 z 750 (**57%**); zdalne adresy: 54% odpowiada, 36% chce logowania, 10% milczy | ≈ |
| Skille dla agentów | 58 766 skilli; mediana **56 instalacji**; 1% skilli zbiera 77% instalacji | ≈ |
| Katalog wtyczek Claude | 544 wtyczki, 1 224 konektory; ranking „usage-based"; brak ocen i recenzji | ≈ |

Wniosek: narzędzi przybywa szybciej, niż ktokolwiek je sprawdza, a rejestr z założenia tego nie
robi. W jedynym teście, jaki znalazłem, 43% serwerów nie uruchomiło się od ręki — najczęściej
przez konfigurację albo klucze, o których testujący nie wiedzieli.

### 7.2 Prawdziwe incydenty

| Kiedy | Co się stało | |
|---|---|---|
| 09.2025 | `postmark-mcp` (npm): kopia serwera, która od wersji 1.0.16 wysyłała ukrytą kopię każdego maila do atakującego. ok. 1 500 pobrań tygodniowo. | ≈ |
| 02.2026 | „ClawHavoc": 341 z 2 857 zbadanych skilli OpenClaw było złośliwych. Osobny przegląd Snyk: 36,8% z 3 984 skilli miało problem bezpieczeństwa. | ≈ |
| 02.2026 | Sklonowany serwer MCP Oura trafił do katalogu MCP Market i instalował złodzieja haseł. | ≈ |
| 02.2026 | `cline@2.3.0`: wstrzyknięcie promptu w tytule zgłoszenia doprowadziło do kradzieży tokenu npm; ok. 4 000 pobrań w 8 godzin. | ≈ |
| 07.2025 | `mcp-remote`, CVE-2025-6514 (9,6): wykonanie kodu po połączeniu z niezaufanym serwerem. | ≈ |
| 08.2026 | Robak Shai-Hulud dostarczony przez wpis w oficjalnym rejestrze MCP (jedno źródło, OX Security). | ≈ |
| badanie | 1 899 serwerów open source: 7,2% z ogólnymi lukami, 5,5% z zatruciem opisów narzędzi. Benchmark MCPTox: atak przez opis narzędzia udaje się do 72,8%. | ≈ |

Dwie rzeczy, których **nie** znalazłem i których nie wolno udawać: potwierdzonego w naturze
„rug pulla" (serwer zmienia opis po akceptacji, żeby zaatakować) — są tylko dowody koncepcji;
oraz potwierdzonej straty z fałszywego punktu końcowego x402.

**Co z tego wynika dla nas, uczciwie:** „nie zadziałało" od ludzi **nie wykryje** złośliwego kodu
— do tego służą skanery. Wykryje to, czego skanery nie widzą: że narzędzie się nie uruchamia, że
potrzebuje klucza, o którym README milczy, że jest porzucone. Złośliwość ma u nas osobną linię
(`reported for`), i tak ma zostać.

### 7.3 Jak ludzie wybierają dziś

- Po gwiazdkach: ranking MCP Market to „Top 100 MCP Servers, ranked by GitHub stars"; 10 serwerów
  zbiera 45,7% wszystkich gwiazdek (O'Reilly). ≈
- Po nazwie: znajoma nazwa oryginału „creates trust, but the code the user actually gets is
  entirely under a third party's control" (Hacker News, o masowych forkach). ≈
- Bez żadnego sprawdzenia: „there's no standard way to verify what an MCP server actually does
  before you connect to it" (Hacker News). ≈
- A gwiazdki nie mówią o bezpieczeństwie: „popularity, activity, and verification badges do not
  reliably indicate security" (Trend Micro, 9 695 serwerów). ≈
- Znaczek platformy też nie: w katalogu Anthropic „Verification isn't a security audit". ≈

Nie znalazłem żadnej ankiety, która pyta wprost „po czym wybierasz serwer". To luka w dowodach.

### 7.4 Kto jeszcze ocenia

| Kto | Na czym stoi ocena | „Nie zadziałało"? | Nazwani ludzie? | Agent może zapytać? |
|---|---|---|---|---|
| Oficjalny rejestr MCP | Celowo nic nie ocenia | nie | nie | API, bez ocen ✓ |
| Glama | Automatyczna ocena A–F jakości opisów narzędzi + skan | tylko jako wynik skanu | zakładka recenzji: „No reviews yet" na sprawdzonej stronie | API z kluczem ≈ |
| Skanery (Snyk Agent Scan, Cisco MCP Scanner) | Wykrywanie zatrucia, wstrzyknięć, zmian opisu | znalezisko ≠ „nie działa" | nie | CLI / API ≈ |
| Dominion Observatory | 70% z raportów agentów (sukces, opóźnienie, błędy) | tak, od agentów | nie (anonimowi agenci) | tak, narzędzie MCP; **0,5% z 22 561 serwerów ma jakikolwiek zapis** ≈ |
| mcpreview.dev | „community-driven ratings and reviews" | możliwe | możliwe | — ; sprawdzone pozycje: „No ratings yet" ≈ |
| Katalog Anthropic | Etykiety Verified / Community, ranking po użyciu | nie | nie | nie ≈ |
| Rejestr reputacji ERC-8004 | Opinie on-chain od adresów | tak | nie; 59–91% recenzentów wygląda na sybile | tak ≈ |
| **ARP** | Linie agentów: `worked` / `failed` + powód z zamkniętej listy | tak | nie (klucz agenta) | tak, MCP; **14 wyników, wszystkie od portfeli ARP** ✓ |
| **AgentScore (po planie)** | Różni ludzie po obu stronach, w kontekście | **tak** | **tak** | **tak, bramka zamknięta na „nie"** |

Dwa uczciwe wnioski. **Po pierwsze,** nikt nie ma naraz: nazwanych ludzi, strony „nie zadziałało",
kontekstu i odpowiedzi dla agenta. **Po drugie,** każda próba recenzji od ludzi, jaką znalazłem,
jest pusta („No reviews yet", „No ratings yet"), a serwis z raportami agentów ma dane o 0,5%
serwerów. Trudne nie jest zbudowanie strony. Trudne jest to, żeby ktoś wrócił i powiedział. Stąd
ryzyko nr 1 w sekcji 11 i stąd hak w chwili użycia (podróż C, krok 6).

**Kolizja nazwy.** Istnieją inne produkty o nazwie „AgentScore": `agentscore.sh` (reputacja
portfeli agentów w x402 i ERC-8004, z własnym serwerem MCP) oraz paczka `agentvault-score`
(skaner serwerów MCP z wynikiem 0–100). ≈ To nie blokuje planu, ale przed kampanią trzeba
sprawdzić, czy nasza nazwa w katalogach MCP nie zostanie z nimi pomylona.

### 7.5 Cztery „dlaczego"

**Dlaczego developer sprawdzi AgentScore przed instalacją?**
- *Moment:* README każe wkleić `claude mcp add …` albo `npx …`, a narzędzie chce klucza API.
- *Wyzwalacz:* gwiazdki nic nie mówią o tym, czy to ruszy; w teście 750 serwerów z rejestru 43%
  nie ruszyło od ręki.
- *Nagroda:* w 10 sekund widzi, czy ktoś z imienia to uruchomił, do czego, i czy ktoś się
  sparzył. Albo pyta o to swojego agenta jednym zdaniem.
- *Warunek, bez którego to nie działa:* muszą tam być dane. Dlatego lista startowa i kampania
  w społeczności, która tych narzędzi używa.

**Dlaczego ktoś powie „zadziałało / nie zadziałało" po użyciu?**
- *Moment:* tuż po tym, jak ruszyło — albo po 40 minutach walki z brakującym kluczem.
- *Wyzwalacz:* link od agenta na koniec sesji (`sayUrl`), znaczek w README, prośba buildera.
- *Nagroda:* imię na stronie narzędzia, wpis na własnym profilu, a przy „nie zadziałało" —
  ostrzeżenie następnej osoby i sygnał dla buildera. Na testnecie kosztuje to tTRUST z kranu.
- *Uczciwie:* to najsłabsze ogniwo całego planu. Patrz ryzyko nr 1.

**Dlaczego builder wklei nasz znaczek do README?**
- *Moment:* publikacja narzędzia albo post o nim.
- *Wyzwalacz:* w rejestrze jest 74 tysiące serwerów, a mediana skilla to 56 instalacji; gwiazdki
  ma każdy fork.
- *Nagroda:* „3 named people say it worked" — coś, czego fork nie skopiuje i gwiazdki nie
  udowodnią. Link prowadzi jego użytkowników prosto do wypowiedzi. A gdy ktoś powie „nie
  zadziałało", builder wie kto i w czym — to darmowy raport błędu z imieniem.

**Dlaczego agent zapyta nas przed wywołaniem albo płatnością?**
- *Moment:* przed `mcp add`, przed pierwszym wywołaniem obcego narzędzia, przed płatnością x402.
- *Wyzwalacz:* sam projekt MCP mówi, że opisy narzędzi trzeba traktować jako niezaufane, a klient
  nie ma jak sprawdzić serwera przed połączeniem.
- *Nagroda:* jedno wywołanie, odpowiedź `allow` / `deny` / `unknown` pod własną polityką pytającego
  plus jedno zdanie do przekazania człowiekowi. Za darmo, bez klucza. Gdy nie umiemy odczytać,
  mówimy „nie wiem", i to nie jest „tak".

### 7.6 Co dostaje osoba, która mówi (i co doda mainnet)

Dziś nic — to pęknięcie nr 4. Po planie, w tej kolejności:

1. **Imię przy narzędziu.** Widoczne dla każdego, kto sprawdza, i dla każdego agenta, który pyta.
2. **Zapis na profilu** (Etap 14): co powiedziała i jak to się utrzymało. Zapis, nie ranking.
3. **Wpływ:** jej słowo zmienia odpowiedź bramki. Przy trzech osobach — dosłownie.
4. **Na mainnecie — cenę, nie zarobek.** Sprawdziłem na kontrakcie: nasze depozyty idą na krzywą 1
   („Linear Curve"), gdzie cena udziału jest stała. Wpłata 0,04 i wpłata 100 tTRUST dostają ten
   sam kurs (0,99 udziału za 1 tTRUST), więc wczesna pozycja **nie rośnie**, gdy przychodzą
   następni. Hasło aplikacji Intuition „earn when your intuition proves right" dotyczy krzywej 2
   („Offset Progressive Curve"), której nie używamy. Wejście i wyjście kosztują po 1%: pozycja
   admina z lipca (0,03069 udziału) jest dziś warta przy wypłacie 0,03038 tTRUST.
   Czyli mainnet da wypowiedzi **koszt** — a przez to wagę i odporność na farmienie — nie zysk.

**Rekomendacja:** zostać na krzywej 1 i nie obiecywać zarobku. Krzywa 2 to rynek na pierwszym
planie: nagradza tego, kto powie wcześnie i przyciągnie kapitał, niezależnie od tego, czy
narzędzia użył. To dokładnie ta zachęta, której teza zabrania. Jeśli właściciel chce kiedyś
„earn", to jest osobna, świadoma decyzja o zmianie tezy, nie skutek uboczny mainnetu.

Czego **nie** dajemy i nie damy: punktów, nagród, miejsc w rankingu, większej wagi głosu. Każda
z tych rzeczy to cena za decyzję, a decyzji nie da się u nas kupić.

---

## 8. Co tniemy, łączymy, zamrażamy

„Zamrozić" = zdjąć z menu i stopki, nie dotykać kodu; trasa działa. Żadna trasa nie znika bez
przekierowania.

| Co | Decyzja | Powód | Trasa |
|---|---|---|---|
| **Skills** (3 440 linii) | Zamrozić | 8 wolnych napisów, nie narzędzia; nie odpowiada na pytanie rdzenia | `/skills` → przekierowanie na `/agents?kind=tool`. API `/api/v1/skills*` zostaje, oznaczone *deprecated*. |
| **Register an agent / a skill** | Połączyć z rdzeniem | Zastępuje to „dodaj po adresie" | `/register` → `/check` |
| **Claims** (2 385 linii) | Zamrozić | Wolne trójki bez kontekstu użycia; trzeci produkt | `/claims` działa, bez linków w menu i stopce |
| **Evaluators** | Połączyć z profilem osoby | „Kto dobrze ocenia" to teraz zapis na profilu (P6), nie waga 0,5–1,5× | `/evaluators` → lista osób (Etap 14); do tego czasu zamrożone |
| **Wagi ewaluatorów i ich bramka atestacji** | Zamrozić | Wpływają tylko na backing score, który schodzi z pierwszego planu | — |
| **Leaderboard** | Zamrozić na stałe | Ranking ludzi tworzy zachętę do farmienia; P6 mówi „zapis, nie ranking" | `/leaderboard` → `/agents` |
| **IntuForge** (≈ 4 170 linii) | Zamrozić | Drugi produkt w repo jednej osoby | `/explore/intuforge` działa, bez linków |
| **Panel rynku** (Buy / Sell, wykres krzywej, PnL) | Usunąć z powierzchni agenta | Język rynku obok „ludzie mówią"; teza: kapitał to nie zaufanie | W modalu zostaje jedna linia `Backing: X tTRUST by N wallets` i — **koniecznie** — `Withdraw backing` dla tych, którzy mają pozycję. Nikt nie może zostać z zablokowanym depozytem. |
| **Trust contexts** (`/domains`) | Zostaje, łączy się z rdzeniem | To jest „za co" | bez zmian |
| **9 z 12 narzędzi MCP** | Zostają, bez reklamy | Na froncie: `should_i_trust`, `search_agents`, `get_agent_trust` | — |
| `/test-intuition` (995 linii), `/lab` | Zamrozić | Strony robocze | już za flagą środowiskową |
| Etap 2b (Trust Provider ERC-8004) | Dalej wstrzymany | Ocena z 1 osoby to szum | — |

Menu po zmianie: **Start** — `Check before you use` · `Say if it worked` (lista) · `For developers`.
**More** — `Trust contexts` · `People` (od Etapu 14). Reszta znika z menu i ze stopki.

---

## 9. Plan: etapy 10–15

Każdy etap to jeden przebieg agenta. Liczba sukcesu jest czytana z naszego API.

| Etap | Cel | Liczba sukcesu (z API) | Co odblokowuje |
|---|---|---|---|
| **10. Dodaj to, czego używasz** | Każdy adres ma kartę; lista startowa; pierwsza osoba tworzy atom przepisem ARP. Kampania staje się uczciwa. | 14 dni po: `stats.attesters ≥ 10` (dziś 1), `stats.itemsWithPeople ≥ 8` (dziś 2), `stats.trustEvents7d ≥ 10` (dziś 0) | Całą kampanię „zaufaj temu, czego używasz" |
| **11. „Nie zadziałało"** | Druga strona trójki, „Disputed", `maxPeopleAgainst` w bramce | 14 dni po: `stats.peopleAgainst ≥ 3`, co najmniej 1 pozycja z ludźmi po obu stronach | Reputację zamiast listy poparć; bramkę, która odmawia z powodu |
| **12. Jedna liczba** | Ludzie jako nagłówek w API, statystykach i MCP; backing zdegradowany; cięcia z sekcji 8 | `stats.mostTrusted` istnieje i zgadza się z pierwszą pozycją `/api/v1/agents`; `agentsEstablished + agentsVerified ≥ 3` (dziś 0) | Spójny przekaz do zespołu Intuition i do README |
| **13. Agent pyta przed instalacją** | `should_i_trust` dla dowolnego adresu, `summary` i `signal`, linia ARP, `sayUrl` | `stats.gateCalls7d ≥ 50` (dziś `null` — wymaga Upstash, 5 minut właściciela) | Podróż C; wspólny materiał z ARP |
| **14. Profil osoby** | „Co powiedzieli" i „jak to się utrzymało" | `stats.peopleWithRecord ≥ 5` (osoby, po których ≥ 2 inne powiedziały to samo) | Odpowiedź na „co dostaje ten, kto mówi" |
| **15. Sybil v1 i decyzja o mainnecie** | Imiona i wiek kont w odpowiedzi bramki; pozycja liczy się po 7 dniach, po obu stronach; raport | Podrobienie „Verified" albo „Disputed" wymaga 7 dni; dokument z decyzją | Mainnet albo świadome „jeszcze nie" |

Kolejność jest celowa. Etap 10 jest pierwszy, bo bez niego prosimy ludzi o nieuczciwe zaufanie.
Etap 11 przed 12, bo „jedna liczba" bez drugiej strony byłaby tylko połową nagłówka.

### Szkice promptów

**Etap 10 — Dodaj to, czego używasz**
1. `lib/item-address.ts`: `normaliseToolUrl` i dokument Thing przepisane z ARP słowo w słowo, wyliczenie CID i id atomu; testy na wektorach z testnetu (`github.com/intuition-box/ARP` → `0x6c55098b…`, `…/sonarqube-mcp-server` → `0x2617a53f…`).
2. `/check` przyjmuje adres: rodzaj z hosta, id atomu z adresu, odczyt tego jednego atomu i jego trójek istniejącym czytnikiem atestacji; brak atomu → karta `Nobody has said anything about this yet` z linkiem zaufania `?q=<adres>&for=<slug>`.
3. Sprawdzanie istnienia tylko na stałych hostach (GitHub, npm, PyPI); żadnego pobierania adresów użytkownika; literówka → komunikat, nie atom.
4. Pierwsza wypowiedź o nowej pozycji: przypięcie dokumentu, **porównanie URI z wyliczonym** (różnica = stop), `createAtom` przez FeeProxy, potem dzisiejsza ścieżka zaufania. Linia kosztu pokazuje dodatkowy podpis i 0,001 tTRUST.
5. `lib/seed-items.ts` (45 adresów z sekcji 5.7; wielkość liter jak w kanonicznym adresie repozytorium) i lista w trzech sekcjach: `People have spoken` / `Tools people use` / zwinięty rejestr.
6. Słowa: `Used it?`, wymagane `I've used this myself.`, stała linia o braku powiązania. Znaczek przy zerze pokazuje zaproszenie, nie zero.
7. `/api/v1/stats`: nowe `items`, `itemsWithPeople`. Istniejące pola bez zmian. Bez strony „przeciw" — to Etap 11.
8. Testy, harness (karta dla adresu z atomem i bez), CI, merge. Żadnej transakcji z przebiegu.

**Etap 11 — „Nie zadziałało"**
1. Czytnik atestacji liczy ludzi po obu stronach wg sekcji 5.5 (pozycje kontr-skarbca już czyta); portfel po obu stronach jednej trójki nie liczy się nigdzie — test na prawdziwym przypadku z testnetu.
2. `calculateAgentTier` dostaje stronę przeciwną: `disputed`, tier `unverified` przy sporze; chip `Disputed`; teza §4 i §6 (P2, P3) oraz `CLAUDE.md` w tym samym PR.
3. Dialog: `Did it work for you?` → `It worked` / `It didn't work`; wpłata na kontr-trójkę przez FeeProxy (najpierw symulacja; `HasCounterStake` → `You said it worked. Take that back first.`).
4. `Your trust` pokazuje obie strony, wycofanie jak dziś (prosto z MultiVault).
5. Bramka: `maxPeopleAgainst`; bez niego pozycja sporna = `deny` ze zdaniem dlaczego; odpowiedź zyskuje `peopleAgainst`, `disputed`, `areas[].peopleAgainst`.
6. `/api/v1/stats`: `peopleAgainst`, `itemsDisputed`. Znaczek: `3 worked · 1 didn't`.
7. Testy: 3/2 sporne, 10/2 niesporne, 1/1 nic; jeden portfel nie robi sporu; domyślne 0,04 × 2 przekracza próg po stronie „przeciw".

**Etap 12 — Jedna liczba**
1. `people: { for, against }` na każdym obiekcie pozycji w REST i MCP; `score.kind: "backing"`.
2. `stats.mostTrusted` po ludziach; `topAgent` zostaje z `basis: "backing"`; żaden ekran go nie pokazuje.
3. Domyślne sortowanie `/api/v1/agents` i narzędzi MCP po ludziach; `?sort=backing` zachowuje stare.
4. `CLAUDE.md`: nowa sekcja nagłówka, stara jako „Backing score (legacy)"; `llms.txt`, `/docs`, `SKILL.md`, README; dwa dokumenty punktacji do `docs/archive/`.
5. Cięcia z sekcji 8: menu, stopka, przekierowania `/skills`, `/register`, `/leaderboard`; panel Buy / Sell znika, `Withdraw backing` zostaje.
6. Testy: żadna trasa nie zwraca 404; osoba z pozycją backing może ją wycofać; pola API sprzed zmiany mają te same nazwy i wartości.

**Etap 13 — Agent pyta przed instalacją**
1. `should_i_trust` i `GET …/gate` przyjmują adres (ten sam resolver co `/check`); `agentId` zostaje jako alias.
2. Nowe pola odpowiedzi: `summary` (jedno zdanie), `signal` (`worked` / `disputed` / `mixed` / `none` / `unknown`), `people[]` (do 10: imię, strona, kontekst, od kiedy), `reports`, `sayUrl`.
3. Czytnik linii ARP (`uses` → `has outcome`, zapytanie 1 z ich `docs/34`): blok `usage: { source: "arp", worked, failed, topReason, readAt }`; nieudany odczyt = `null`, nigdy 0; nigdy w liczbie ludzi.
4. Opis narzędzia MCP mówi wprost, kiedy wołać: przed dodaniem serwera MCP, skilla albo wtyczki, przed wywołaniem lub płatnością; i że `signal: "none"` to nie ostrzeżenie.
5. `SKILL.md` i fragment do `CLAUDE.md` użytkownika: „before adding an MCP server, call should_i_trust"; po sesji podaj człowiekowi `sayUrl`.
6. Strona `/docs`: co czytamy od ARP i czego nie liczymy. Tekst wspólnego posta z wieedze w PR.
7. Testy: adres bez atomu → `deny` + `signal: "none"`; nieudany odczyt → `unknown`; linia ARP nie zmienia tieru.

**Etap 14 — Profil osoby**
1. `/profile/[address]`: `What they said` (pozycja, strona, kontekst, data) z istniejących odczytów zdarzeń.
2. Początek wypowiedzi = początek bieżącej nieprzerwanej pozycji (z depozytów i wypłat), nie `created_at` wiersza pozycji — inaczej da się „zarezerwować" wczesną datę pyłem.
3. `How it held up`: ile razy ≥ 2 inne osoby powiedziały potem to samo; ile razy przeciwnie; ile zostało bez echa. Liczby i daty, bez procentów poniżej 5 wypowiedzi, bez sortowania ludzi.
4. Zdanie na ekranie: `This is a record, not a rank.` Zapis nie wchodzi do tieru, bramki ani żadnej wagi — test, który to pilnuje.
5. `/evaluators` → lista osób alfabetycznie / po dacie pierwszej wypowiedzi (nigdy po „trafności").
6. `stats.peopleWithRecord`. Teza P6.

**Etap 15 — Sybil v1 i decyzja o mainnecie**
1. Odpowiedź bramki: przy każdej osobie `ens`, `accountSince`, `itemsSpokenAbout`; polityka `minNamedPeople`, `minAccountAgeDays`.
2. Pozycja liczy się do tieru i do sporu po 7 dniach; karta mówi `counts from <date>`; teza §6.
3. Flaga jednolitości: portfel, który tego samego dnia mówi to samo o wielu pozycjach tą samą kwotą.
4. Test ataku: 3 świeże portfele → dalej `Unverified`; 2 świeże portfele → dalej nie `Disputed`.
5. Raport: liczby z 12 tygodni wprost z API; koszt wypowiedzi na mainnecie, zmierzony; co aplikacja pokaże o wartości pozycji (sekcja 7, „co daje mainnet") — decyzja właściciela.
6. Decyzja wg progu z przeglądu: mainnet tylko przy ≥ 10 pozycjach `Established` i ≥ 50 osobach.

---

## 10. Co robi z tego „banger": nowe wideo, 60 sekund

Poprzedni pomysł („trzy osoby zmieniają zdanie agenta przed płatnością") zostaje jako drugi akt, ale
płatności agent–agent są małe, a instalowanie narzędzi dzieje się codziennie. Nowy kadr otwierający:

**„Should I install this?"**

| Czas | Kadr |
|---|---|
| 0–6 s | Terminal, Claude Code. Użytkownik: „add an MCP server for my database". Agent znajduje dwa. Napis: `Before it installs, it asks.` |
| 6–16 s | Agent woła `should_i_trust` dla pierwszego. Po prawej strona pozycji: chip `Disputed`, `2 people say it didn't work for AI / Coding` — dwa imiona. Agent: „Two named people say this one didn't work. I'll check the other." |
| 16–26 s | Drugi adres. `3 people say it worked for AI / Coding` — trzy imiona, `Verified`, `Read 1 min ago`. Agent instaluje. |
| 26–40 s | Narzędzie działa: jedno prawdziwe zapytanie do bazy, wynik na ekranie. |
| 40–52 s | Agent: „Did it work? Say it under your own name" + link. Telefon: `It worked` → `AI / Coding` → podpis. Licznik na stronie przechodzi z 3 na 4, pojawia się czwarte imię. |
| 52–60 s | Plansza: `People who used it told the agent. Then one more did. Nobody paid for the answer.` Adres strony. |

**Dlaczego to się niesie:** każdy, kto instalował serwer MCP z README, zna ten moment niepewności.
„Nie zadziałało" z imieniem to coś, czego nie pokazuje żaden katalog. Zgodne z tezą: prawdziwe
pozycje, różne portfele, nic kupionego. **Koszt:** Etapy 10, 11 i 13; nagranie to wieczór
właściciela.

---

## 11. Ryzyka i najtańszy test każdego

| Ryzyko | Najtańszy test |
|---|---|
| **Ludzie nie wracają powiedzieć, czy zadziałało** — to największe ryzyko całego planu. | Po Etapie 10: 20 osób ze społeczności Intuition dostaje jeden link do narzędzia, którego używają. Mniej niż 6 wypowiedzi w 7 dni = sama strona nie wystarczy; potrzebny hak w chwili użycia (ARP, `sayUrl`). |
| **ARP robi to samo i ma dystrybucję w Claude Code.** | Jedna wiadomość do wieedze z Appendix A, przed Etapem 10. Jeśli nie chce wspólnych atomów albo sam doda ludzi pod imieniem — AgentScore zostaje bramką i czytnikiem nad ich danymi. To też jest produkt, tylko mniejszy. |
| **Przypięcie w IPFS daje inny CID niż wyliczony.** | Pierwszy krok Etapu 10: jedno przypięcie adresu, który już ma atom, i porównanie. Różnica = stop przed jakimkolwiek zapisem. |
| **„Disputed" jako broń: 2 portfele oczerniają cudze narzędzie.** | Etap 11: test, że 2 przeciw przy ≥ 5 za nie robi sporu. Imiona i daty są widoczne. Wiek pozycji 7 dni (Etap 15) przed mainnetem. |
| **Pozew albo pretensja od firmy, której narzędzie jest na liście.** | Stała linia o braku powiązania; tylko fakty („N osób mówi…"), żadnych własnych ocen; adres e-mail do zgłoszeń. Przed kampanią: przeczytać stronę jednej pozycji oczami prawnika tej firmy. |
| **Nikt nie potwierdzi użycia — pole wyboru to tylko deklaracja.** | Nie udajemy, że jest inaczej (P2, reguła 7). Po 2 tygodniach: ile portfeli wypowiedziało się o > 5 pozycjach tego samego dnia. |
| **Zmiana domyślnego sortowania API zaskoczy integratora.** | `gateCalls7d` i logi: dziś nie widać żadnego zewnętrznego odbiorcy. `?sort=backing` zostaje. |
| **`is skilled in` okaże się złym predykatem dla narzędzi.** | Jedno pytanie do zespołu Intuition (Appendix A) przed mainnetem. Na testnecie zmiana jest tania. |
| **Lista startowa wygląda jak podszywanie się pod marki.** | Etykietą jest adres, nie logo; żadnych cudzych znaków graficznych; linia o braku powiązania na każdej karcie. |
| **Plan na Hobby nie wytrzyma ruchu z wideo.** | Pinger z Etapu 9d + pamięć podręczna już są. Przed publikacją: 200 zapytań do `/check?q=…` w minutę z jednego skryptu. |
| **Dane z testnetu przepadną.** | Pytanie do Intuition, to samo co w listopadzie. Jeśli tak — mówić to ludziom przed pierwszą wypowiedzią. |

---

## Appendix A — One page for the Intuition team, wieedze (ARP) and tool builders

**AgentScore: before you use an AI agent or a tool, see what the named people who used it say.
After you use it, say whether it worked.**

**What changes.** AgentScore listed agents almost nobody had used and asked people to "trust"
them. People can only speak honestly about what they have used. So the subject becomes anything
with an address that people really use (an MCP server, a repository, a package, a skill, an
agent), and the statement gets its second side:

```
[item] — is skilled in — [context]
  deposit on the triple          = "it worked for me, for this context"
  deposit on its counter-triple  = "it didn't work for me, for this context"
```

Every statement has a name, a context and a date. Only distinct people count; past a dust floor
the amount decides nothing; one wallet can lift nothing and dispute nothing. An item is *Disputed*
when at least 2 people, and at least one in three of everyone who spoke, say it didn't work. An
agent that asks (`should_i_trust`, MCP or REST) gets allow / deny / unknown under its own policy.
A read we can't make is `unknown`, and unknown is not a yes.

**Where it stands (testnet 13579, 2026-11-25).** Live site, REST and MCP. One person has an open
statement; no item passes the default gate. The plan's first step makes the ask honest. It adds
no feature for its own sake.

**For wieedze / ARP.** We read `docs/34` and `declare/tool-thing.ts`, re-implemented the recipe
(normalised URL → schema.org Thing → CIDv1 raw sha2-256 → atom id) and checked it against two of
your atoms on 13579: same ids. AgentScore will derive an item's atom that way and no other, so a
tool has one atom, not two.

| | ARP | AgentScore |
|---|---|---|
| Who speaks | an agent, with a key made on the user's machine | a person, with their own wallet, under their name |
| Shape | `(agent, uses, tool)` → `has outcome` → `worked` / `failed` | a deposit on, or against, `(tool, is skilled in, context)` |
| Verdict | none | a tier and a gate, under the caller's policy |

Your outcomes get their own line on every item page and never enter the people count, the tier or
the gate's default. Three questions:

1. Your hook asks the user once, after a session, whether to share the result. Could it also show
   one link, "say it under your own name", to the same atom on AgentScore?
2. `source` edges between two addresses of one tool (Docker image → repository): should a reader
   add statements up across them, or only link them? We link, and wait for your answer.
3. Would your adapter read positions on `(tool, is skilled in, context)` and its counter-triple as
   the human signal? If another shape is easier for you, tell us before mainnet.

**For the Intuition team.** Two findings, three questions.

- On 13579 a deposit on a counter-triple from a wallet that holds the positive side reverts with
  `MultiVault_HasCounterStake`. But some triple creators from October 2025 hold shares on both
  sides, and the check is per curve. A reader that counts supporters and opposers should expect
  both-side wallets. We count such a wallet on neither side.
- Our deposits use curve 1 (Linear Curve): the share price is flat, so an early position does not
  gain when others follow. We plan to keep it that way and never promise earnings.
- **Which atom shape should a tool have?** `intuition-data-structures` says `SoftwareSourceCode`
  with `name` and `codeRepository`; the ERC-8004 guide and the 770 tool atoms on 13579 are pinned
  `Thing`s. We follow the atoms that exist. Tell us if mainnet should differ.
- **Is there a canonical predicate you would rather see for "works for <context>"?** We use
  `is skilled in` (`0xe332e7d6…`) because we will not mint a competence predicate, but on testnet
  it is used almost only for people (71 of 75 triples). On testnet we can still change.
- Will the consumer app write statements about tools itself? If so, we read yours instead of
  duplicating them.

**For tool builders.** Your tool already has a page: paste its address at `/check`. Nothing to
register, nothing to pay. Copy the link, send it to three people who used the tool, and put the
badge in your README. Three distinct people who say it worked and it reads *Verified*: on the
page, on the badge, and to any agent that asks. If someone says it didn't work, you can't remove
it, but you see who and for what, which is a bug report with a name on it. AgentScore is not
affiliated with the projects it lists and says nothing about a tool itself. It shows what the
people who used it said.

---

## Aneks B — każde twierdzenie i jego podstawa

**[zweryfikowane]** = sprawdziłem sam, w tym przebiegu: poleceniem, odczytem łańcucha, zapytaniem do
indeksera, ścieżką w kodzie albo otwarciem źródła. **[założenie]** = nie sprawdziłem sam. Do
założeń należą też fakty z wyciągów wyszukiwarki i ze stron otwartych tylko przez agenta
pomocniczego — z dopiskiem, skąd pochodzą.

### Stan produktu i łańcuch

| Twierdzenie | Podstawa |
|---|---|
| `main` = `5d3403f` (Etap 9d); PR-y #33–#40 zmergowane | [zweryfikowane: `git log --merges`] |
| 8 agentów, 1 osoba ufająca, `topAgent` = OPEN CLAW z `trustScore 98`, `agentsEstablished` 0, `gateCalls7d` null | [zweryfikowane: `GET /api/v1/stats` na produkcji, 2026-11-25 22:34 UTC] |
| OPEN CLAW: `trustScore 98`, 1 staker, tier `unverified`; Luda: `trustScore 50` | [zweryfikowane: `GET /api/v1/agents?limit=20` na produkcji] |
| Ta sama odpowiedź `/stats` miała `dataAgeSeconds: 6672` (pinger z Etapu 9d najpewniej nie jest jeszcze ustawiony) | [zweryfikowane: jw.]; przyczyna — [założenie] |
| Żywe pozycje na trójkach Ludy: portfel admina na Knowledge / Productivity i AI / Coding; pozycja 0xCCA0… na Social ma 0 udziałów | [zweryfikowane: zapytanie GraphQL `triples{positions counter_positions triple_term}`] |
| Hasura ma `counter_term_id`, `counter_positions`, `triple_term{supporter_count, opposer_count}` | [zweryfikowane: introspekcja `__type(name:"triples")`, `triple_term`] |
| `getCounterIdFromTripleId(Luda—Knowledge)` = `0x23b942ee…` = `counter_term_id` z Hasury; `isCounterTriple` = true | [zweryfikowane: `readContract` na MultiVault `0x2Ece8D4d…`, testnet 13579] |
| Na 75 trójkach `is skilled in` nie ma ani jednej żywej pozycji „przeciw" | [zweryfikowane: `triples_aggregate(where:{predicate_id, counter_positions:{shares>0}})` = 0] |
| 71 z 75 trójek `is skilled in` ma podmiot typu `Account`; 25 ma ≥ 1 wspierającego, 3 mają ≥ 2 | [zweryfikowane: zapytanie GraphQL, limit 100] |
| Wpłata „przeciw" z portfela trzymającego „za" → `MultiVault_HasCounterStake` (bezpośrednio, wsadowo, przez FeeProxy; także świeży portfel próbujący obu stron w jednej transakcji) | [zweryfikowane: `simulateContract` (eth_call ze `stateOverride` salda); nic nie wysłano] |
| Wpłata „przeciw" 0,04 tTRUST ze świeżego portfela → 0,0396 udziału (MultiVault i FeeProxy) | [zweryfikowane: jw.] |
| Istnieją portfele z żywymi udziałami po obu stronach jednej trójki (4 z 40 sprawdzonych) | [zweryfikowane: zapytanie GraphQL + `getShares` na łańcuchu dla `0xbb3ce3c0…`: 0,001 po każdej stronie] |
| …i pochodzą z transakcji tworzenia trójki z 2025-10-22 (blok 8 107 293, nadawca = MultiVault) | [zweryfikowane: tabela `deposits`]; że to mechanizm tworzenia, a nie coś innego — [założenie] |
| Kontr-skarbiec na krzywej 2 nie daje się otworzyć wpłatą (`CannotDirectlyInitializeCounterTriple`) | [zweryfikowane: symulacja] |
| Koszty: atom 0,001, trójka 0,001, min. depozyt 0,001 tTRUST; opłaty skarbca 1% wejście / 1% wyjście / 1% protokół | [zweryfikowane: `getAtomCost`, `getTripleCost`, `getGeneralConfig`, `getVaultFees`] |
| FeeProxy: stała opłata 0, procentowa 2,5% | [zweryfikowane: `scripts/fee-calldata.ts --check`] |
| Koszt pierwszej wypowiedzi ≈ 0,043 tTRUST | [założenie: suma powyższych; nie zmierzone jedną symulacją] |
| RPC, które działa: `testnet.rpc.intuition.systems/http` (blok 9 379 165) | [zweryfikowane: `eth_blockNumber`] |
| Blokada przeciwnej strony jest na krzywą: „Counter-stake is scoped per curve…" | [zweryfikowane: `0xIntuition/intuition-contracts-v2` → `src/libraries/MultiVaultLib.sol`, `_hasCounterStake`, gałąź `main`]; że testnet działa na tej wersji — [założenie] |
| Krzywa 1 = „Linear Curve" (domyślna), krzywa 2 = „Offset Progressive Curve"; na krzywej 1 kurs jest stały (0,99 udziału za 1 tTRUST przy 0,04, 1 i 100 tTRUST) | [zweryfikowane: `getBondingCurveConfig`, rejestr krzywych `getCurveName`, `previewDeposit`] |
| Pozycja admina 0,03069 udziału → `previewRedeem` 0,0303831 tTRUST | [zweryfikowane: `previewRedeem`] |
| „Users can stake either FOR or AGAINST a statement"; „Main Vault (FOR)" / „Counter Vault (AGAINST)"; „Positive Vault" / „Negative Vault" | [zweryfikowane: `0xIntuition/intuition-docs` → `docs/_data/intuition-sdk/triples-guide.md`, `docs/_data/portal.md`] |
| „Pin first and compare the returned URI to the canonical atom's `data` field before minting"; `pinThing` wymaga `name`, `description`, `image`, `url` | [zweryfikowane: `0xIntuition/intuition-docs` → `docs/_data/erc-8004-agent-layer.md`] |
| Zalecenie `SoftwareSourceCode` z `name` i `codeRepository` | [zweryfikowane: `0xIntuition/intuition-data-structures` → `classifications/software/index.md`] |
| `trust` / `distrust` to w dokumentach Intuition dwa osobne predykaty; X zapisuje się jako `x.com/<handle>`; forma bazowa `use` ma własne id (ARP używa `uses`) | [założenie: odczytane przez agenta pomocniczego z `intuition-data-structures/predicates/…`, nie przeze mnie] |
| Na testnecie jest 105 przypadków portfela po obu stronach tej samej trójki na tej samej krzywej, wszystkie sprawdzone z 2025-10-22 | [założenie: policzył agent pomocniczy; ja sprawdziłem 4 z 40] |
| Wątki 1265 i 1276 na Atlasie | [założenie: nieotwarte; tytuł 1265 tylko z wyniku wyszukiwarki — https://atlas.discourse.group/t/arp-the-reputation-layer-ive-been-building-toward/1265] |
| „Earn when your intuition proves right" na stronie aplikacji Intuition | [założenie: sprawdzone w przeglądzie z 2026-11-15, nie ponownie] |

### ARP i atomy narzędzi

| Twierdzenie | Podstawa |
|---|---|
| Hasło ARP „Check before your agent installs or pays"; wynik `worked` / `failed` z powodem z zamkniętej listy; „so far every result written about a skill comes from ARP's own test agents" | [zweryfikowane: `raw.githubusercontent.com/intuition-box/ARP/main/README.md`] |
| Kształt linii ARP (`uses` → `in context of` → `has outcome` → `because`…), id predykatów, „ARP never reads the size of a deposit", brak globalnego wyniku i werdyktu, pytania otwarte | [zweryfikowane: `docs/34_ARP_AS_A_SIGNAL_GENERATOR.md` w tym repo, wersja z 2026-11-11] |
| Przepis na atom narzędzia (`normaliseToolUrl`, stałe zdanie opisu, kolejność kluczy, CIDv1 raw sha2-256) | [zweryfikowane: `packages/protocol/src/declare/tool-thing.ts`, `thing-cid.ts`] |
| Odtworzony przepis daje dane `ipfs://bafkreiewwuermy…` i id `0x6c55098b…` dla `github.com/intuition-box/ARP` oraz id `0x2617a53f…` dla `…/sonarqube-mcp-server` — zgodne z testnetem | [zweryfikowane: własny skrypt + `calculateAtomId` na MultiVault + porównanie z Hasurą] |
| 770 atomów `Thing` ze stałym opisem ARP: 742 pod `github.com`, 10 npm, 2 PyPI, 2 Docker, reszta to adresy serwerów MCP; 676 to skille (`?skill=`), 94 bez zapytania | [zweryfikowane: stronicowane zapytanie `things(where:{description:{_eq:…}})`] |
| Pierwszy taki atom: 2026-10-28; twórcy: 2 portfele | [zweryfikowane: zapytanie GraphQL] |
| 13 nazw z wielkimi literami; 0 z końcowym `/`, `.git` albo `www.`; `url` zawsze = `https://` + `name` | [zweryfikowane: analiza tych 770 wierszy] |
| `uses`: 195 trójek, 169 żywych pozycji, 103 portfele; to predykat ogólny (od 10.2025), nie tylko ARP; 40 podmiotów „Agent 13579:N" | [zweryfikowane: stronicowane zapytania] |
| `has outcome`: 14 trójek (7 `worked`, 7 `failed`), utworzone przez 3 portfele ARP, 7 portfeli trzyma pozycję | [zweryfikowane: zapytanie GraphQL, 2026-11-25] |
| 72 trójki `has type → MCP Server` na testnecie; liczby ARP dla mainnetu 1155 | [założenie: liczby z dokumentu ARP, nie liczyłem sam] |
| Klucz agenta ARP powstaje na maszynie użytkownika (`~/.arp/agent-key`), nie jest jego portfelem | [zweryfikowane: `apps/web/public/docs/what-arp-publishes.md` w repo ARP] |
| API przypinania Intuition zwróci ten sam CID co wyliczony lokalnie | [założenie: tak twierdzi komentarz w kodzie ARP; bramki IPFS i mutacje były z piaskownicy niedostępne] |
| ● na liście startowej = atom istnieje na testnecie | [zweryfikowane: nazwy z listy 94 atomów]; `github.com/modelcontextprotocol/servers`, `…/claude-code`, `@modelcontextprotocol/sdk` nie istnieją jako atomy — [zweryfikowane: `isTermCreated`] |
| ○ na liście startowej = repozytorium istnieje pod tym adresem | [zweryfikowane: `raw.githubusercontent.com/<owner>/<repo>/HEAD/README.md` → 200 dla 18 repozytoriów]; `cursor.com` — [założenie: host zablokowany] |

### Kod

| Twierdzenie | Podstawa |
|---|---|
| Atomy „Skills": 8 wolnych napisów; jeden z depozytem (0,0099) | [zweryfikowane: `GET /api/v1/skills` na produkcji; filtr `SKILL_WHERE_STR` w `lib/gql-filters.ts`] |
| `foldDuplicateAtoms` grupuje po etykiecie sprowadzonej do małych liter | [zweryfikowane: `src/lib/atom-fold.ts`] |
| Czytnik atestacji już pobiera pozycje kontr-skarbca (`opposePositions`, `opposeStake`) | [zweryfikowane: `src/lib/attestation-reader.ts`] |
| `topAgent` wybierany po `trustScore`; `/api/v1/agents` sortuje po `agentScore` | [zweryfikowane: `src/lib/api-data.ts:451`, `:1452–1500`] |
| Polityka bramki: `minTier` albo `minPeople` (+ `area`); nie znaleziono → `deny` | [zweryfikowane: `src/lib/trust-gate.ts`] |
| Zdarzenia zaufania mają datę z `created_at` wiersza pozycji | [zweryfikowane: `src/lib/trust-events.ts`] |
| Wiersz pozycji przeżywa pełną wypłatę (więc „wczesną datę" da się zarezerwować pyłem) | [zweryfikowane: pozycja 0xCCA0… ma 0 udziałów i nadal istnieje]; że ponowna wpłata nie zmienia `created_at` — [założenie] |
| Rozmiary: Skills 3 440, Claims 2 385, IntuForge ≈ 4 170 (752 + 2 132 + 1 288), `/test-intuition` 995 linii; całość 61 783 | [zweryfikowane: `wc -l`] |
| 12 narzędzi MCP | [zweryfikowane: lista w `app/api/mcp/[transport]/route.ts`] |
| Etapy 10–15 mieszczą się każdy w jednym przebiegu | [założenie: na podstawie rozmiaru Etapów 9–9d] |

### Rynek, incydenty, konkurencja

| Twierdzenie | Podstawa |
|---|---|
| Oficjalny rejestr MCP: 74 270 serwerów, 50 276 ze zdalnym adresem | [zweryfikowane: pełne przejście `registry.modelcontextprotocol.io/v0/servers` przez agenta pomocniczego 2026-11-25; odczytałem plik wynikowy i sam potwierdziłem, że API odpowiada] |
| npm `@modelcontextprotocol/sdk`: 93 196 652 pobrań tygodniowo, 380 464 357 miesięcznie, 87 188 zależnych | [zweryfikowane: `registry.npmjs.org/-/v1/search`] |
| „our SDKs just crossed 5 billion total downloads, and more than 4.5 billion of those came in the past year alone" | [zweryfikowane: `blog.modelcontextprotocol.io/posts/mcp-turns-two/`] |
| Rejestr: „consumers should assume minimal-to-no moderation"; nie usuwa serwerów słabych ani z lukami | [zweryfikowane: `modelcontextprotocol/registry` → `docs/modelcontextprotocol-io/moderation-policy.mdx`] |
| 427 z 750 serwerów uruchamia się (57%) | [założenie: wyciąg — https://buttondown.com/mcpverified/archive/mcp-verified-1-427-of-750-mcp-servers-actually/] |
| Zdalne adresy: 54% odpowiada, 36% chce logowania, 10% milczy | [założenie: wyciąg — https://stork.ai/blog/mcp-registry-endpoints-checked-november-2026] |
| Skille: 58 766, mediana 56 instalacji, 1% zbiera 77,4% | [założenie: wyciąg — https://skillselion.com/state-of-ai-agent-skills-2026] |
| Claude: 544 wtyczki, 1 224 konektory, ranking „usage-based", „Verification isn't a security audit" | [założenie: otwarte przez agenta pomocniczego — https://claude.com/plugins , https://claude.com/docs/connectors/directory] |
| `postmark-mcp` | [założenie: wyciąg — https://www.koi.ai/blog/postmark-mcp-npm-malicious-backdoor-email-theft ; https://osv.dev/vulnerability/MAL-2025-47604] |
| ClawHavoc 341 / 2 857; Snyk ToxicSkills 36,82% z 3 984 | [założenie: wyciąg — https://www.koi.ai/blog/clawhavoc-341-malicious-clawedbot-skills-found-by-the-bot-they-were-targeting ; https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/] |
| Klon serwera Oura w MCP Market | [założenie: wyciąg — https://www.straiker.ai/blog/smartloader-clones-oura-ring-mcp-to-deploy-supply-chain-attack] |
| `cline@2.3.0`, ok. 4 000 pobrań w 8 h | [założenie: wyciąg — https://snyk.io/blog/cline-supply-chain-attack-prompt-injection-github-actions] |
| `mcp-remote` CVE-2025-6514, CVSS 9,6 | [założenie: wyciąg — https://nvd.nist.gov/vuln/detail/CVE-2025-6514] |
| Shai-Hulud przez oficjalny rejestr MCP | [założenie: wyciąg, jedno źródło — https://www.ox.security/blog/shai-hulud-outbreak-debrief-the-worm-evolves-into-mcp/] |
| 7,2% / 5,5% z 1 899 serwerów; MCPTox 72,8% | [założenie: wyciąg — https://arxiv.org/abs/2506.13538 ; https://arxiv.org/abs/2508.14925] |
| Brak potwierdzonego „rug pulla" w naturze i brak potwierdzonej straty z fałszywego punktu x402 | [założenie: agent pomocniczy szukał i nie znalazł — to nie dowód, że nie istnieją] |
| Ranking MCP Market po gwiazdkach; 45,7% gwiazdek w 10 serwerach | [założenie: wyciąg — https://www.mcpmarket.com/leaderboards ; https://www.oreilly.com/radar/mcp-in-practice/] |
| Cytaty z Hacker News | [założenie: wyciąg — https://news.ycombinator.com/item?id=47428217 ; https://news.ycombinator.com/item?id=44604453] |
| „popularity, activity, and verification badges do not reliably indicate security" | [założenie: wyciąg — https://www.trendaisecurity.com/en/resources-insights/research/stars-dont-save-you-popularity-is-not-security-in-the-mcp-ecosystem] |
| Glama: oceny A–F, „No reviews yet" | [założenie: wyciąg — https://glama.ai/blog/2026-04-03-tool-definition-quality-score-tdqs] |
| Dominion Observatory: 0,5% z 22 561 serwerów ma zapis | [założenie: wyciąg, dane własne dostawcy — https://dev.to/vdineshk/i-checked-22561-mcp-servers-almost-none-have-a-reliability-record-heres-how-to-vet-one-before-6pi] |
| mcpreview.dev: „No ratings yet" | [założenie: wyciąg — https://www.mcpreview.dev/] |
| Snyk Agent Scan, Cisco MCP Scanner | [założenie: wyciąg — https://github.com/snyk/agent-scan ; https://github.com/cisco-ai-defense/mcp-scanner] |
| ERC-8004: 59–91% recenzentów wygląda na sybile | [założenie: wyciąg — https://arxiv.org/abs/2606.26028] |
| Inne produkty „AgentScore" (`agentscore.sh`, `agentvault-score`) | [założenie: wyciąg — https://github.com/agentscore/mcp ; https://socket.dev/npm/package/agentvault-score] |
| Opisy narzędzi MCP trzeba traktować jako niezaufane | [założenie: wyciąg — https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/] |
| Nikt inny nie ma naraz nazwanych ludzi, strony „nie zadziałało", kontekstu i odpowiedzi dla agenta | [założenie: wniosek z powyższych; przegląd nie jest wyczerpujący] |

### Projekt i hipotezy

| Twierdzenie | Podstawa |
|---|---|
| Ludzie wrócą powiedzieć, czy zadziałało | [założenie — test w sekcji 11] |
| Buildery wkleją znaczek | [założenie — nie testowane od listopada] |
| wieedze zgodzi się na wspólne atomy i link w haku | [założenie — pytania w Appendix A] |
| Próg „Disputed" (≥ 2 osoby i ≥ 1 na 3) jest rozsądny | [założenie: projekt, nie pomiar; do rewizji po pierwszych danych] |
| Dziś zmiana domyślnej decyzji bramki przy sporze nie zmienia niczyjej odpowiedzi | [zweryfikowane: 0 pozycji „przeciw" na naszych trójkach] |
| Żaden zewnętrzny odbiorca nie polega na domyślnym sortowaniu `/api/v1/agents` | [założenie: `gateCalls7d` jest `null`, nie ma jak tego zmierzyć] |
