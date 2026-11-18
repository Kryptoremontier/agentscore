# AgentScore — przegląd strategii (listopad 2026)

> Stan na 2026-11-15, commit `614b413` (produkcja = ten sam commit). Przegląd tylko czyta i
> analizuje: żadnych zmian w kodzie produktu. Każde twierdzenie ma oznaczenie w Aneksie B:
> **[zweryfikowane]** albo **[założenie]**.

## Czego nie udało się sprawdzić (przeczytaj najpierw)

- **Strona na żywo w przeglądarce.** Sandbox nie puszcza ruchu do `agentscore-gilt.vercel.app`.
  Zrzuty ekranu pochodzą z lokalnego builda produkcyjnego **tego samego commita** co produkcja,
  na żywych danych z testnetu (1440×900 i 390×844, harness `npm run shots`: 72 zdane, 8 pominiętych).
  API produkcyjne (`/api/v1/stats`, bramka) odczytałem przez narzędzie Vercela.
- **Stawki FeeProxy on-chain.** RPC testnetu nie odpowiada z sandboxa. Wiem, co robi kod; stawki
  (0,001 tTRUST + 2,5%) znam tylko z `docs/FEE_MODEL.md`.
- **WalletConnect na produkcji.** Nie mam dostępu do zmiennych środowiskowych. W lokalnym buildzie
  telefon dostaje tylko „Injected — Browser Wallet" i „Coinbase Wallet".
- **Źródła rynkowe.** Cytaty pochodzą z wyników wyszukiwarki, nie z otwartych stron. Trzy kluczowe
  sprawdziłem drugim wyszukiwaniem (badanie arXiv o ERC-8004, spadek x402 wg Fireblocks, granty
  Intuition). Reszta ma w Aneksie B oznaczenie „tylko wyciąg z wyszukiwarki".
- **Wnętrze aplikacji Intuition.** Jest za listą oczekujących; widziałem tylko stronę publiczną.
- **Poprawki do briefu:** kohorta ERC-8004 ma **265** agentów, nie 168. Etap 8b **nie jest w
  kolejce** — oba przebiegi są zmergowane (PR #34 i #35, 2026-11-15).

---

## 1. Werdykt w 5 zdaniach

1. **Zawęzić, nie kontynuować „tak jak jest".** Produkt ma 58 850 linii kodu, 1 223 testy, 14
   endpointów i 12 narzędzi MCP, a agentom ufają **2 osoby, z których jedna to Ty**.
2. **Nie pivotować poza tę przestrzeń.** Luka jest prawdziwa: badanie rejestru reputacji ERC-8004
   pokazuje, że opinię da się tam podrobić za ułamek centa, a nikt inny nie ma „nazwanych ludzi +
   kontekstu + bramki, która odmawia".
3. **Wąskim gardłem nie jest produkt, tylko to, że nikt nie ma powodu zaufać agentowi w tym
   miesiącu.** Od 11 lipca powstały 4 zdarzenia zaufania; od 1 czerwca nie zarejestrowano żadnego
   nowego agenta.
4. **Jedno zadanie na 90 dni:** dać builderowi agenta dowód, że ufają mu prawdziwi ludzie — jeden
   link, który wkleja wszędzie — i nie budować niczego, co nie podnosi jednej liczby: ilu agentów
   przechodzi domyślną bramkę (dziś: **0**).
5. **Próg wyjścia:** jeśli 6 tygodni po Etapie 9 będzie mniej niż 30 osób i mniej niż 5 agentów
   „Established", problemem jest popyt, nie wykonanie — wtedy zamrażasz stronę ludzką i zostajesz
   czytnikiem/bramką dla grafu Intuition, finansowanym z grantu.

**Mainnet:** jeszcze nie. Zapis zostaje na testnecie, dopóki nie ma 10 agentów „Established" i 50
osób. Powód: na mainnecie każda osoba musi zdobyć TRUST na osobnym L3, a dziś nie umiesz
przeprowadzić przez ten lejek nawet ludzi z darmowym tTRUST. Mainnet teraz zabiłby zasiew.
Uczciwa cena tej decyzji: na testnecie zaufanie nic nie kosztuje, więc bramka nie chroni jeszcze
prawdziwych pieniędzy. Mów to wprost.

## 2. Jedno zadanie, które czyni nas niezbędnymi

**„Dowód, że temu agentowi ufają prawdziwi, nazwani ludzie."** Jedna jednostka danych, trzy
odczyty: karta dla człowieka (`/check/[id]`), znaczek dla README/X buildera, bramka dla maszyny.

Test „czy zauważyliby, gdyby jutro zniknęło":

| Kandydat | Kto by zauważył dziś | Werdykt |
|---|---|---|
| Bramka przed płatnością | Nikt. Domyślna polityka odmawia **każdemu** istniejącemu agentowi (Luda: 2 osoby, 0,0455 tTRUST, próg 0,05). | Cel, nie klin. Bez danych jest pusta. |
| Karta jako dowód społeczny | Builder, który wkleił link. To on ma powód przyprowadzić ludzi. | **Klin.** To ona tworzy dane. |
| Graf kontekstów dla Intuition | Zespół Intuition — jeśli będzie w nim ruch. | Skutek uboczny klina; argument do grantu. |
| Reputacja „ludzi, którzy dobrze oceniają agentów" | Nikt przy 2 osobach. | Za wcześnie. Zamrozić. |

Bramka staje się niezbędna dopiero później: kto ją wpiął w ścieżkę płatności, ten bez niej nie
płaci (zamyka się na „nie"). To samo czyni ją trudną do przyjęcia dziś: nikt poważny nie wepnie w
płatności usługi na planie Hobby z pustym grafem. Dlatego kolejność to **karta → dane → bramka**.

**Co przestajemy robić:** wszystko, co nie skraca drogi „builder wysyła link → 3 osoby ufają".
Lista w sekcji 11.

## 3. Banger: „Trzy osoby zmieniają zdanie agenta"

Jedna strona na żywo, `/gate/<agent>`: wielka decyzja bramki, która na oczach widza przechodzi
z **DENY** na **ALLOW**, gdy prawdziwi ludzie ufają agentowi — i dopiero wtedy agent płaci.

**Wideo, 60 sekund, kadr po kadrze:**

| Czas | Kadr |
|---|---|
| 0–5 s | Terminal. Agent OPEN CLAW ma zadanie i chce zapłacić agentowi X 0,01 USDC (x402, sieć testowa). Napis: „Before it pays, it asks." |
| 5–12 s | Wywołanie `should_i_trust`. Ekran dzieli się: po prawej strona `/gate/X`, czerwone **DENY**, zdanie z bramki: „No one trusts this agent for Crypto / Onchain." Płatność wstrzymana. |
| 12–20 s | Telefon nr 1. Osoba otwiera link zaufania, wybiera „Crypto / Onchain", podpisuje. Na stronie pojawia się pierwsza pieczęć z nazwą ENS. Licznik: 1 z 3. |
| 20–32 s | Telefony nr 2 i 3. Kolejne dwie nazwy. Zegar w rogu biegnie naprawdę — bez cięcia w czasie odczytu, bo dane mają swój wiek. |
| 32–42 s | Strona przechodzi na zielone **ALLOW**. Zdanie: „3 people trust this agent for Crypto / Onchain." Chip „Verified". |
| 42–52 s | Terminal: agent pyta ponownie, dostaje `allow`, wysyła płatność. Link do transakcji. |
| 52–60 s | Plansza: „Three people changed an agent's mind. Nobody paid for the decision." Adres strony. |

**Dlaczego to się niesie:**
- Zespół Intuition dostaje dowód własnej tezy: zaufanie w ich grafie **rusza pieniądze**, a nie
  tylko ranking.
- Środowisko x402 dostaje brakujący element: audyt katalogu Bazaar podaje 57% szans trafienia na
  usługę, która nie odpowiada.
- Czerwone → zielone, ludzkie imiona, 60 sekund. Nie trzeba znać protokołu.

**Zgodność z tezą:** prawdziwe pozycje, trzy różne portfele, nic kupionego. **Koszt:** dwa etapy
(strona na żywo; prawdziwa płatność testowa w `demo:gate`, która dziś „nigdy nie płaci").

## 4. Test 30 sekund

Pierwszy ekran telefonu dziś: „LIVE ON INTUITION TESTNET" · „AI AGENTS, TRUSTED BY REAL PEOPLE." ·
„See who trusts an agent, and for what, before you use it, pay it, or let your agent call it." ·
[Check an agent] · [How it works ↓].

| Kto | Co rozumie | Co klika | Gdzie odpada |
|---|---|---|---|
| **Builder agenta** | „Agentom ufają ludzie" — jasne. | Szuka „mój agent". Nie ma takich drzwi. Rejestracja jest w „More → Create → Register an agent". | Wpisuje swojego agenta w `/check`. Widzi „Nobody has trusted this agent for any trust context yet. Be the first". Jedyna akcja to „Trust this agent" — a jeden portfel nic nie podnosi. Udostępnienie na X brzmi „X: 0 people trust it on AgentScore." Nikt nie opublikuje zera o sobie. |
| **Użytkownik krypto, który daje agentowi portfel** | „before you use it, pay it" — trafia. | „Check an agent". Pole podpowiada „Luda, 8453:1380, 0x45078a…". Wpisuje nazwę agenta, którego używa. | „No agent by that name or id on AgentScore or in the ERC-8004 registry." Albo karta z zerem. Brak odpowiedzi = brak powrotu. |
| **Dev agenta płacącego innym (x402)** | Sekcja 03 jest dobra: prawdziwy JSON, `dataAgeSeconds`. | „For developers →". | Bramka przyjmuje **tylko** identyfikator atomu Intuition (0x + 64 znaki). Dev zna kontrahenta po adresie, URL albo id ERC-8004. `/check` to rozwiązuje, bramka nie. Do tego `examples/trust-gate.ts` nie jest podlinkowany z `/docs`, `llms.txt` ani SKILL.md. |
| **Osoba ze społeczności Intuition** | Słowa „trust", „trust context" — swojskie. | „Trust an agent" → lista 274 agentów. | 272 z 274 nikt nie ufa i ona żadnego nie zna. W sekcji 04 połowa kafli mówi „No one trusts an agent here yet" (Entertainment, Agriculture, Energy, Safety / Identity). Widzi pustkę i wychodzi. |

**Droga „zaufaj temu agentowi" dziś** (nowa osoba z portfelem, bez sieci Intuition): około
8 kliknięć w aplikacji, wyjście do kranu z tTRUST i do **5 okien portfela** (połączenie, dodanie
sieci, przełączenie, jednorazowa zgoda dla FeeProxy, depozyt). Ta sama droga dla kogoś ze
społeczności Intuition (sieć i tTRUST już ma): 3–4 kliknięcia, 2–3 okna. To rozstrzyga, kogo zapraszać
najpierw (sekcja 5).

Ważne: to tarcie zatrzymuje uczciwych, a nie farmerów. Skrypt przechodzi je za darmo.

### Top 5 poprawek (wpływ ÷ wysiłek)

| # | Ekran | Dziś | Propozycja | Dlaczego |
|---|---|---|---|---|
| 1 | Bramka (REST + MCP) | Tylko `0x…64` | Ten sam resolver co `/check`: id ERC-8004 (`8453:1380`), portfel, nazwa. Niejednoznaczne → `unknown`. | Bez tego dev x402 nie ma jak zapytać. Mały koszt: resolver już istnieje. |
| 2 | Pierwszy ekran + karta | Jedne drzwi: „Check an agent" | Drugie drzwi: „Built an agent? Get your trust link". Na karcie tryb buildera: „Send this to 3 people who used it." Tekst na X przy zerze: „I listed {name} on AgentScore. Used it? Trust it for {context}." | Builder to jedyna osoba z powodem, by przyprowadzić ludzi. |
| 3 | Dialog zaufania | Kontekst do wyboru, potem niespodzianki z portfela | Link niesie kontekst (`?for=crypto-onchain`). Jeden krok „Set up Intuition Testnet" (dodaj + przełącz). Zapowiedź: „2 signatures. The first one only once." Link do kranu z powrotem. | 5 okien bez uprzedzenia = porzucenie. |
| 4 | Landing §04 i `/agents` | 4 puste kafle; lista 274 z 272 zerami | Landing: konteksty z ludźmi + jedna linia „4 more contexts are open — be the first". `/agents`: najpierw „People trust these (2)", niżej zwinięte „Not trusted yet (272)". | Pustka pokazana 4 razy wygląda jak martwy produkt. Jedna uczciwa linia wystarczy. |
| 5 | Karta `/check`, modal | „BACKING 50 ?" w nagłówku | Backing pod „Details". | Druga liczba obok „2 people trust it" rozmywa jedyne przesłanie. |

Poza rankingiem, 10 minut: opis repo na GitHubie brzmi „Stake on agents you trust, **earn when
others follow**" — sprzeczne z własną zasadą „bez earn/buy/sell".

## 5. Zimny start

**Diagnoza.** 2 osoby (kryptoremontier.eth i 0xCCA0…A21C), 4 zdarzenia zaufania w 4 miesiące,
z czego 3 Twoje. Z 9 agentów „AgentScore" większość to Twoje obiekty testowe („json object",
„OPEN CLAW … for Testing AgentScore", „Skill: On-Chain Data Analyzer"). Karta na landingu pokazuje
więc twórcę serwisu ufającego agentowi dwa razy. To uczciwe, ale obcy czyta to jako „nikogo tu nie ma".

**Kto ma najsilniejszy powód przyprowadzić pierwsze 100 osób:** builder agenta — bo karta jest
o nim. **Kto może zaufać najtaniej już w tym miesiącu:** ludzie ze społeczności Intuition — bo
tylko oni mają sieć i tTRUST.

| Pętla | Koszt dla Ciebie | Szybkość | Ocena |
|---|---|---|---|
| **Społeczność Intuition + buildery z ich ekosystemu** (ARP, Hive Mind, AgentID) | 2 posty, 10 wiadomości, 1 demo | dni | **Zakład nr 1.** Zero tarcia po ich stronie. |
| Buildery z kohorty ERC-8004 zapraszają użytkowników | 20 wiadomości z gotową kartą | tygodnie | Zakład nr 2. Skaluje się, ale ich użytkownicy trafiają na pełne tarcie. |
| Sygnały użycia z ARP | Etap integracji; zależy od wieedze | tygodnie | Pokazywać osobno („used by N agents"), nigdy w tierze. To nie ludzie. |
| Hive Mind (roszczenia o kontach X) | Rozmowa z Kylanem | nieznana | Warte jednej wiadomości: wiele agentów to konta X. |
| Integracja z aplikacją Intuition | Poza Twoją kontrolą | miesiące | Nie planować. Zapytać (sekcja 12). |

**Pierwsze 2 tygodnie, wieczór po wieczorze (1–2 h):**

| Dzień | Co |
|---|---|
| 1 | Popraw opis repo. Wybierz 10 agentów z rozpoznawalnym builderem: 5 z ekosystemu Intuition, 5 z kohorty. Sprawdź na własnym telefonie, czy da się połączyć portfel (5 minut). |
| 2 | Jedna wiadomość-szablon, 4 zdania: link do karty ich agenta, „dziś 0 osób", „3 osoby = Verified", prośba o 3 testerów. |
| 3–4 | 5 wiadomości dziennie do builderów z ekosystemu Intuition (Discord, Atlas). |
| 5 (pt) | Publiczna piątkowa sesja demo kohorty grantowej na Discordzie Intuition albo post w #ecosystem: pokaż jedną kartę i poproś obecnych o zaufanie agentowi, którego **używali**. |
| 6–7 | Odpowiedzi. Post na X z kartą pierwszego agenta, któremu ufa ktoś poza Tobą — z imionami. |
| 8–10 | 10 wiadomości do builderów z kohorty ERC-8004, każda z obrazkiem ich własnej karty. |
| 11 | Post na Atlasie: ile osób, ilu agentów, gdzie ludzie odpadali. Liczby, nie hasła. |
| 12 (pt) | Drugie demo: `npm run demo:gate` przed i po — bramka zmienia odpowiedź. |
| 13–14 | Policz i zdecyduj. |

**Liczby na dzień 14** (z `/api/v1/stats`): `attesters` ≥ 20 (dziś 2), ≥ 3 agentów „Established",
≥ 5 odpowiedzi na 20 wiadomości. **Poniżej 8 osób = ta pętla jest zła**; nie buduj nic więcej,
zanim nie zrozumiesz dlaczego.

Zasada kampanii: nagradzasz to, **kim ktoś jest** (imię na liście pierwszych), nigdy to, **komu
zaufał**. Inaczej kupujesz decyzje.

## 6. Rynek: trzy prawdziwe porównania

| | Co robi | W czym lepsze | W czym słabsze od AgentScore |
|---|---|---|---|
| **Rejestr reputacji ERC-8004** | Standard: surowe opinie o agentach, on-chain, na wielu sieciach. Agregacja poza łańcuchem. | Skala i neutralność: setki tysięcy zarejestrowanych agentów. | Badanie arXiv 2606.26028: tylko ok. 3% / 4% / 15% agentów (Ethereum / BSC / Base) ma żywą usługę; opinię da się zmanipulować za ok. 0,003–0,055 USD; duża część recenzentów to sybile. Brak kontekstu, brak „kto". |
| **Virtuals ACP (agenci-ewaluatorzy)** | Agent ocenia wynik zlecenia przed zwolnieniem escrow. | Jest tam prawdziwy ruch: 2,55 mln zleceń, 45,5 tys. agentów (dane własne Virtuals). | Ocena dotyczy jednego zlecenia, wystawia ją agent, działa tylko w ich rynku. Nie odpowiada na „komu ufają ludzie i za co". |
| **Tożsamość agenta: Visa TAP, Mastercard Agent Pay, Skyfire KYAPay, World AgentKit** | Potwierdzają, **kto** stoi za agentem, wobec sprzedawcy. | Dystrybucja i marka; World wiąże agenta ze zweryfikowanym człowiekiem. | Scentralizowane katalogi. Mówią „kto", nie „czy warto i w czym". |

**Tło popytu, bez upiększeń:** miesięczna liczba transakcji x402 spadła o 92% od grudniowego
szczytu i trzyma się w 4–6 mln; TRM Labs szacuje, że tylko 0,6–7,5% przefiltrowanego wolumenu to
prawdziwy handel agentów. Płatności agent–agent istnieją, ale są małe. To drugi powód, by nie
zaczynać od bramki.

**Co możemy powiedzieć tylko my:** „Każde zaufanie ma imię, datę i kontekst. Jeden portfel nie
podniesie agenta. Decyzji bramki nie da się kupić, a gdy nie umiemy czegoś odczytać, mówimy »nie
wiem«." W ekosystemie Intuition bliscy sąsiedzi to ARP (reputacja ze stakingu użycia, testnet)
i AgentID (grant, kohorta 1) — partnerzy do czytania, nie rywale do ścigania.

## 7. Model biznesowy

**Co dziś robi FeeProxy:** w kodzie przez FeeProxy idą tworzenie atomów, tworzenie trójek i
depozyty; wypłata idzie prosto do MultiVault, bez opłaty. Opłatę (stała + procent) kod czyta
z kontraktu. `docs/FEE_MODEL.md` opisuje inny, „hybrydowy" model — dokument jest nieaktualny.
Przychód dziś: zero (tTRUST nie ma wartości).

| Opcja | Kto płaci i za co | 100 / 1 000 / 10 000 wywołań bramki tygodniowo | Co się psuje, gdy zrobisz to źle |
|---|---|---|---|
| **A. Granty Intuition (IEII)** | Fundusz ekosystemu: za dane o agentach i przypadek „zaufanie rusza płatność". | Niezależne od ruchu. Kohorta 1: 100 tys. USDT na ok. 9 zespołów. | Nic w zaufaniu. Ryzyko: zależność od jednego sponsora. **Jedyne realne pieniądze na 12 miesięcy.** |
| **B. Płatna bramka przez x402** | Agent, który **pyta** — nigdy oceniany. Np. 0,002 USD za decyzję. | ok. 0,20 / 2 / 20 USD tygodniowo. | Paywall przed zasiewem dusi adopcję. Opłata od ocenianego = sprzedaż decyzji. |
| **C. Plan z gwarancją dostępności** | Rynki agentów i integratorzy: limit, SLA, webhook przy zmianie tieru. | 0 / 0–1 klient / 2–5 klientów × 29–99 USD mies. | Obietnica SLA na planie Hobby, której nie dotrzymasz. |
| **D. Opłata FeeProxy od depozytów** | Osoba, która ufa. | Przy stawce 0,01 TRUST: ułamki TRUST tygodniowo nawet przy 10 000. | To podatek od najrzadszego zachowania w produkcie. **Ustaw 0 dla zaufania, dopóki graf nie żyje.** |

Odrzucone: **płatne „zweryfikowane listingi"** (każdy przeczyta to jako kupione zaufanie) oraz
**udział w obrotach rynków** (Olas: ok. 110 tys. USD łącznego obrotu — procent z niczego).

Wniosek wprost: do ok. 100 000 wywołań tygodniowo to nie jest biznes, tylko infrastruktura
finansowana grantem. Prawo do pobierania opłat zdobywasz liczbą agentów, którzy przechodzą bramkę.

**Trzy zdania dla kierownictwa Intuition:**
1. AgentScore tworzy w Waszym grafie region, którego aplikacja konsumencka nie dotyka: ludzie
   ufają agentom AI za konkretny kontekst, pod własnym imieniem.
2. To pierwsze miejsce, gdzie zaufanie z Intuition zmienia decyzję maszyny: agent pyta bramkę
   i płaci albo nie płaci.
3. Każdy builder agenta, który chce dowodu zaufania, przyprowadza do Intuition swoich użytkowników
   i ich depozyty — prosimy o miejsce w kohorcie grantowej i jedną rozmowę o tym, czy Wasza
   aplikacja będzie pisać zaufanie do agentów, żebyśmy je czytali, a nie dublowali.

## 8. Sybil

**Stan faktyczny:** „Verified" kosztuje dziś **3 jednorazowe portfele i 0,1 tTRUST łącznie**. Nie
50 portfeli — trzy. Do tego wypłata jest bez opłaty, więc możliwy jest atak błyskawiczny: zaufaj
z 3 portfeli, bramka przepuszcza, płatność przechodzi, wypłać.

| Obrona | Tarcie dla uczciwych | Zmiana tezy? |
|---|---|---|
| **1. Pokaż, kim są ludzie.** W karcie i w odpowiedzi bramki dla każdej osoby: nazwa ENS lub jej brak, od kiedy konto istnieje w Intuition, ilu agentom ufa. Nowe pokrętła polityki: `minNamedPeople`, `minAccountAgeDays`. | Zero. | Nie. Tier bez zmian; decyduje polityka pytającego. |
| **2. Wiek pozycji.** Pozycja liczy się do tieru po 7 dniach. | „Verified" przychodzi tydzień później. | Doprecyzowanie: „żywa pozycja" = żywa od 7 dni. Bez tego atak błyskawiczny kosztuje tylko gaz. |
| **3. Wykrywanie jednolitości.** Portfel ufający wielu agentom tego samego dnia tą samą kwotą dostaje widoczną flagę. | Zero. | Nie. |
| **4. Na mainnet:** „Verified" wymaga, by 2 z 3 osób były „znane" (nazwa ENS albo konto Intuition starsze niż 30 dni, któremu ktoś ufa). | ENS kosztuje; alternatywa to 30 dni czekania. | Tak. Bez tego na mainnecie „Verified" = 0,1 TRUST. |

Rekomendacja: **1 + 2 + 3 przed mainnetem**, 4 jako decyzja w dniu mainnetu. Dowód osobowości
(World ID, Human Passport) odrzucam: wysokie tarcie i zewnętrzna zależność przy 2 użytkownikach.
Filtry wieku portfela farmy potrafią udawać — dlatego pokazujemy sygnały i oddajemy decyzję
pytającemu, zamiast udawać, że je rozstrzygamy.

## 9. Plan na 90 dni

**Etap 8b:** zrobiony i zmergowany — zostaje. Dwie korekty wchodzą do Etapu 9: puste konteksty na
landingu (poprawka 4) i karta, która dziś pokazuje głównie Ciebie (naprawia ją zasiew, nie kod).

| Etap | Cel | Liczba sukcesu | Co odblokowuje |
|---|---|---|---|
| **9. Drzwi buildera** (tydz. 1) | Builder dostaje link zaufania i znaczek w 30 s; bramka przyjmuje każde id; statystyki pokazują North Star. | 14 dni po: ≥ 20 osób, ≥ 3 „Established". | Całą kampanię z sekcji 5. |
| **10. Zaufanie w mniej krokach** (tydz. 2–3) | Nowa osoba kończy w < 3 min. | ≥ 25% otwarć dialogu kończy się zaufaniem. | Pętlę „builder → jego użytkownicy". |
| **11. Strona bramki na żywo** (tydz. 4–5) | `/gate/<id>`: DENY → ALLOW na oczach widza. | Strona działa na 3 prawdziwych agentach. | Banger. |
| **12. Prawdziwa płatność + wideo** (tydz. 5–6) | `demo:gate` płaci na sieci testowej po `allow`. | Wideo opublikowane; ≥ 1 udostępnienie z konta Intuition; ≥ 5 builderów pyta o link. | Rozmowę o grancie. |
| **13. Sybil v1** (tydz. 7–8) | Obrony 1–3 z sekcji 8. | Podrobienie „Verified" wymaga 7 dni; bramka zwraca listę osób. | Mainnet. |
| **14. Czytamy innych** (tydz. 9–10) | Użycie z ARP jako osobna linia; odczyt kohorty z mainnetu. | ≥ 1 zewnętrzne źródło w odpowiedzi bramki. | Pozycję „soczewki agentowej" Intuition. |
| **15. Decyzja o mainnecie + wniosek grantowy** (tydz. 11–12) | Dokument z liczbami, nie kod. | Wniosek wysłany. Mainnet tylko przy ≥ 10 „Established" i ≥ 50 osobach. | Następny kwartał. |

**Szkice promptów (po 5 linii):**

**Etap 9**
1. `/check/[id]` w trybie buildera: „Get your trust link", kopiowanie linku z `?for=<slug>`, tekst „Send this to 3 people who used it"; tekst na X przy zerze osób.
2. `GET /badge/<id>.svg`: tier, „N people trust it", wiek danych; `no-store`; gotowy fragment do README.
3. Bramka (REST + MCP) rozwiązuje id tak jak `/check`; niejednoznaczne → `unknown`; istniejące pola bez zmian.
4. `/api/v1/stats`: nowe pola `agentsEstablished`, `agentsVerified`, `trustEvents7d`; licznik wywołań bramki (Upstash).
5. Landing: drugie drzwi dla buildera; puste konteksty w jednej linii; nawigacja bez Skills / Claims / Evaluators / Leaderboard / IntuForge (trasy zostają).

**Etap 10**
1. Policz dzisiejsze kroki testem e2e z portfelem testowym: kliknięcia i okna portfela, jako liczba w PR.
2. Jeden krok „Set up Intuition Testnet"; zapowiedź liczby podpisów przed pierwszym oknem.
3. Kontekst i kwota z linku; domyślna kwota = minimalna.
4. Kran: link z powrotem do dialogu; po powrocie dialog sam rusza dalej.
5. Telefon: sprawdź i napraw połączenie portfela (WalletConnect albo deeplink); zrzuty 390×844.

**Etap 11**
1. `/gate/<id>?minPeople=3&area=…`: decyzja bramki dużą czcionką, zdanie z `reason`, wiek danych.
2. Pieczęcie z nazwami pojawiają się w miarę odczytu; odświeżanie co 15 s z widocznym zegarem.
3. Nieudany odczyt = `unknown` na ekranie, nigdy poprzedni stan.
4. Obraz OG strony = aktualna decyzja, `no-store`.
5. Testy: deny → allow na danych testowych; brak wymyślonych osób.

**Etap 12**
1. `demo:gate`: po `allow` prawdziwa płatność x402 na sieci testowej; po `deny` / `unknown` brak płatności.
2. Wypisz link do transakcji i wiek danych bramki.
3. Flaga `--dry-run` zostawia dzisiejsze zachowanie.
4. README: jak nagrać wideo w 10 minut.
5. Test: `unknown` nigdy nie płaci.

**Etap 13**
1. Odpowiedź bramki: `people[]` z `ens`, `accountSince`, `agentsTrusted` (nowe pole; stare bez zmian).
2. Polityka: `minNamedPeople`, `minAccountAgeDays`; błędna → 400.
3. Tier: pozycja liczy się po 7 dniach; karta mówi „counts from <data>"; teza §6 + CLAUDE.md + testy.
4. Flaga jednolitości przy osobie, z wyjaśnieniem pod „?".
5. Test ataku błyskawicznego: 3 świeże portfele → nadal „Unverified".

**Etap 14**
1. Czytnik pozycji użycia ARP (testnet): osobna linia „used by N agents", nigdy w tierze.
2. Odczyt kohorty ERC-8004 z mainnetu, tylko do odczytu, z wiekiem danych.
3. Odpowiedź bramki: `usage` jako osobny blok; brak danych = `null`, nie 0.
4. Jedna strona `/docs` o tym, co czytamy od innych i czego nie liczymy.
5. Wspólny post z wieedze — tekst w PR.

**Etap 15**
1. Raport: North Star i metryki z 12 tygodni, wprost z API.
2. Koszt zaufania na mainnecie: opłaty i minimalny depozyt, zmierzone.
3. Decyzja wg progu; jeśli „nie" — co zamrażamy.
4. Wniosek do kohorty IEII: trzy zdania z sekcji 7 + liczby + wideo.
5. Lista pytań do zespołu Intuition (sekcja 12).

## 10. North Star i metryki

**North Star: liczba agentów, którzy przechodzą domyślną bramkę** („Established" lub wyżej).
Dziś: **0**. Jedna liczba łączy obie strony: żeby rosła, potrzeba i ludzi, i agentów.

| Metryka | Dziś | Skąd |
|---|---|---|
| Różne osoby, które ufają agentom | 2 | `/api/v1/stats` → `attesters` (jest) |
| Zdarzenia zaufania z ostatnich 7 dni | 0 | `/api/v1/stats` → `trustEvents7d` (dodać w Etapie 9) |
| Wywołania bramki tygodniowo spoza naszej strony | nieznane | licznik w Etapie 9; wymaga Upstash, który od Etapu 7c czeka na Twoje 5 minut |

Dziś z własnego API da się odczytać tylko pierwszą. North Star i dwie pozostałe — po Etapie 9.

## 11. Kill list

„Zamrozić" = zdjąć z nawigacji i nie dotykać. Trasy zostają.

| Co | Dlaczego |
|---|---|
| **Skills** (3 440 linii), **Claims** (2 385), **Evaluators**, **Leaderboard** | Żadna nie odpowiada na jedyne pytanie tezy. Każda pokazuje pustkę i kosztuje utrzymanie. |
| **IntuForge** | Drugi produkt w repo jednej osoby. |
| „Register a skill", „Create claim", `/lab/poc`, `/test-intuition` | Rozpraszają jedyną akcję: zaufaj agentowi. |
| Backing score na pierwszym planie; panel Buy/Sell | Druga liczba i język rynku obok „ludzie ufają". Pod „Details". |
| 9 z 12 narzędzi MCP w dokumentacji „na froncie" | Zostają `should_i_trust`, `search_agents`, `get_agent_trust`. Reszta działa, ale nie jest reklamowana. |
| Etap 2b: publikacja naszych ocen jako „Trust Provider" ERC-8004 | Ocena z 2 osób to szum. Wrócić przy ≥ 50 osobach. |
| Wagi ewaluatorów i ich bramka atestacji | Złożoność, której nikt nie widzi przy 6 ewaluatorach. |
| Opłata FeeProxy od zaufania | Podatek od zachowania, którego brakuje. Zero do odwołania. |
| `docs/ROADMAP.md`, `TOKENOMICS.md`, `VISION.md`, `FEE_MODEL.md`; nieużywane `PLATFORM_FEE_*` w `app-config.ts` | Nieaktualne i sprzeczne z tezą albo kodem. Agent AI czyta je i buduje pod zły obraz. Przenieść do `docs/archive/`. |
| Nowe powierzchnie w ogóle | Do odwołania: etap, który nie podnosi North Star, nie startuje. |

## 12. Ryzyka i czego nie wiemy

| Co obaliłoby ten przegląd | Najtańszy test |
|---|---|
| Buildery nie chcą dowodu zaufania. | 20 wiadomości z kartą. Mniej niż 5 odpowiedzi w 14 dni = klin jest zły. |
| Społeczność Intuition nie ma tTRUST albo ochoty. | Jeden post w #ecosystem z jedną kartą. Policz zaufania w 48 h. |
| Aplikacja Intuition sama doda agentów i zaufanie do nich. | Jedna wiadomość do zespołu z trzema zdaniami z sekcji 7. Jeśli tak — czytamy ich dane; to dla nas dobra wiadomość. |
| Na telefonie nie da się połączyć portfela. | Własny telefon, 5 minut. |
| Zaufanie „bez gazu" jest niemożliwe (odbiorca musi wcześniej zatwierdzić FeeProxy on-chain). | Jedno pytanie do devów Intuition. |
| Dane z testnetu przepadną przy migracji. | To samo pytanie. Jeśli tak — mów to ludziom przed zaufaniem. |
| Płatności agent–agent nie urosną przez lata. | Obserwować miesięczne liczby x402. Dlatego karta, nie bramka, jest klinem. |
| Kampania w społeczności da puste zaufania („klikam, bo proszą"). | Po 2 tygodniach: ile osób ufa więcej niż 5 agentom tego samego dnia. To flaga z sekcji 8. |
| Cytaty rynkowe są z wyciągów wyszukiwarki. | Otworzyć 5 stron z Aneksu B przed publicznym użyciem liczb. |

---

## Appendix A — One page for Intuition leadership and agent builders

**AgentScore: proof that real, named people trust an AI agent — readable by people and by machines.**

**The problem.** Agents are starting to pay and call other agents. The open standard for agent
reputation (ERC-8004) stores raw feedback that an academic study found can be forged for a
fraction of a cent, with most registered agents exposing no live service. Identity schemes say
*who* runs an agent. Nothing says *whether it is worth trusting, for what, according to whom*.

**What AgentScore does.** A person trusts an agent for one trust context by putting a small stake
behind the claim `<agent> — is skilled in — <context>` on Intuition. Every bit of trust has a name
(ENS when there is one), a date and a context.
- **For people:** one card per agent — who trusts it, for what, how old the data is.
- **For builders:** one link and one badge that prove real users stand behind the agent.
- **For agents:** `should_i_trust` (MCP) and a REST gate that answer allow / deny / unknown under
  the caller's own policy, before a payment or a delegation.

**Rules that do not bend.** The tier comes only from distinct people with live positions; capital
on the agent never changes it; one wallet can never lift an agent. No invented numbers. Data age is
always shown. A failed read is `unknown`, and unknown means do not pay. Nothing about a decision is
for sale.

**Where it stands (2026-11-15, testnet).** Live site, REST and MCP, 1,223 tests. 274 agents listed
(9 native, 265 from the ERC-8004 cohort). 2 people have trusted an agent. No agent passes the
default gate yet. That is the honest state, and it is the whole plan: the next 90 days are about
one number — agents that pass the gate.

**For Intuition.** AgentScore creates a region of the graph the consumer app does not touch, and
it is the first place where trust on Intuition changes a machine's decision: an agent asks, then
pays or does not. Every builder who wants proof brings their users and their deposits to
Intuition. We ask for a place in a grant cohort and one conversation about whether the consumer
app will write trust in agents, so that we read it instead of duplicating it.

**For agent builders.** Find your agent, copy its trust link, send it to three people who have
used it. Three distinct people and it reads Verified — on the card, on the badge, and to any agent
that asks.

---

## Aneks B — każde twierdzenie i jego podstawa

**[zweryfikowane]** = sprawdzone poleceniem, odczytem API, ścieżką w kodzie albo zrzutem ekranu.
**[wyciąg]** = źródło z wyniku wyszukiwarki, strona nieotwarta. **[założenie]** = nie sprawdzone.

| Twierdzenie | Podstawa |
|---|---|
| Produkcja = commit `614b413`, stan READY | [zweryfikowane] lista wdrożeń Vercel, 2026-11-15 |
| 9 agentów, 2 osoby ufające, 6 ewaluatorów, 15 claims, 0,927 tTRUST | [zweryfikowane] `GET /api/v1/stats` (produkcja), 2026-11-15 19:59 UTC |
| `topAgent` w statystykach to obiekt testowy „OPEN CLAW … for Testing AgentScore" | [zweryfikowane] ta sama odpowiedź |
| 274 agentów na liście: 9 + 265 z kohorty ERC-8004 (brief: 168) | [zweryfikowane] `/api/v1/agents/page` (lokalny build, żywy testnet) i zrzut `/agents` |
| Dwie osoby: kryptoremontier.eth i 0xCCA0…A21C; 4 zdarzenia zaufania (Luda: 11.07, 1.10, 18.10; Captain Dackie: 3.09), 3 z nich właściciela | [zweryfikowane] zapytanie GraphQL o pozycje + zrzuty kart |
| Ostatni agent AgentScore zarejestrowany 2026-06-01 | [zweryfikowane] `created_at` w `/api/v1/agents/page` |
| Domyślna bramka odmawia Ludzie: 2 osoby, 0,0455 tTRUST < 0,05 | [zweryfikowane] `GET /api/v1/agents/<Luda>/gate` (produkcja) |
| Żaden agent nie przechodzi domyślnej bramki | [zweryfikowane] jedyny agent z 2 osobami to Luda (jw.) |
| Bramka przyjmuje tylko id atomu | [zweryfikowane] `src/lib/api-data.ts:866–885` |
| `/check` przyjmuje nazwę, id ERC-8004, portfel | [zweryfikowane] `src/lib/check-agent.ts` (`parseCheckQuery`) |
| `examples/trust-gate.ts` nie jest wskazany w `/docs`, `llms.txt`, SKILL.md | [zweryfikowane] `grep` po ścieżce — brak trafień; fragment może być wklejony inaczej |
| Do 5 okien portfela przy pierwszym zaufaniu; ok. 8 kliknięć | [zweryfikowane] ścieżka w kodzie: `AttestButton.tsx`, `attest-service.ts`, `intuition.ts:78` (`approve`). Nie przeklikane z prawdziwym portfelem |
| Na telefonie tylko „Injected" i „Coinbase Wallet" | [zweryfikowane] zrzut lokalnego builda; **na produkcji [założenie]** (brak dostępu do env) |
| FeeProxy: tworzenie i depozyty przez proxy, wypłata bez opłaty; stawki czytane z kontraktu | [zweryfikowane] `src/lib/intuition.ts`, `CLAUDE.md` |
| Stawki 0,001 tTRUST + 2,5% | [założenie] tylko `docs/FEE_MODEL.md`; RPC nieosiągalne |
| `docs/FEE_MODEL.md` sprzeczny z kodem; `PLATFORM_FEE_*` nieużywane | [zweryfikowane] porównanie z `intuition.ts`; `grep` |
| Opis repo: „…earn when others follow" | [zweryfikowane] metadane repo w odpowiedzi API GitHuba |
| 58 850 linii źródeł (bez testów), 1 223 testy, 14 endpointów REST, 12 narzędzi MCP | [zweryfikowane] `wc -l`, `vitest run`, `CLAUDE.md` |
| Etap 8b zmergowany (PR #34, #35) | [zweryfikowane] historia gita |
| Słowa na pierwszym ekranie, puste kafle w §04, „BACKING 50", tekst przy zerze osób | [zweryfikowane] zrzuty 390×844 i 1440×900; `src/lib/people-copy.ts` |
| Aplikacja Intuition: lista oczekujących, Stacks, „Choose a trust context", „Earn when your intuition proves right", zero wzmianek o agentach na stronie publicznej | [zweryfikowane] pobranie `app.intuition.systems`, 2026-11-15 |
| Co aplikacja Intuition zapisuje on-chain i czy doda agentów | [założenie] |
| Badanie ERC-8004: ok. 3% / 4% / 15% agentów z żywą usługą; manipulacja za ok. 0,003–0,055 USD; sybile wśród recenzentów | [wyciąg, dwa niezależne wyszukiwania] arXiv 2606.26028 — https://arxiv.org/abs/2606.26028 (wersje v1 i v2 różnią się procentami) |
| x402: −92% miesięcznych transakcji od grudniowego szczytu, potem 4–6 mln miesięcznie; 196 mln transakcji łącznie | [wyciąg, dwa wyszukiwania] Fireblocks — https://www.fireblocks.com/blog/agent-economy-numbers-x402-data |
| Tylko 0,6–7,5% wolumenu x402 to handel agentów | [wyciąg] TRM Labs — https://www.trmlabs.com/trm-tech-blog/whos-actually-paying-measuring-ai-agent-payments-onchain |
| Bazaar: 57% szans na usługę, która nie odpowiada | [wyciąg] raport dostawcy ScoutScore — https://scoutscore.ai/report (źródło zainteresowane) |
| Virtuals ACP: 2,55 mln zleceń, 45 563 agentów | [wyciąg] dane własne Virtuals, przez https://cryptodailyalert.com/virtuals-review-2026 |
| Olas: ok. 110 tys. USD łącznego obrotu | [wyciąg] https://olas.network/mech-marketplace |
| Visa TAP, Mastercard Agent Pay, Skyfire KYAPay, World AgentKit istnieją i dotyczą tożsamości | [wyciąg] https://www.visa.com/en-ua/newsroom/visa-trusted-agent-protocol ; https://skyfire.xyz/industry-articles/how-ai-agents-prove-identity-kya-authentication-authorization-payments/ ; https://www.coindesk.com/tech/2026/03/17/sam-altman-s-world-teams-up-with-coinbase-to-prove-there-is-a-real-person-behind-every-ai-transaction |
| Mainnet Intuition działa od jesieni 2025 (Base L3) | [wyciąg] https://chainwire.org/2025/10/29/intuition-launches-mainnet-with-8-5m-to-build-the-trust-layer-for-ai-and-the-internet/ |
| Granty IEII: kohorta 1, 100 tys. USDT; w niej AgentID i Hive Mind; publiczne piątkowe sesje na Discordzie | [wyciąg, dwa wyszukiwania] https://intuition.box/blog/grant-recipients-cohort-1 ; https://medium.com/0xintuition/grant-recipients-cohort-1-featured-post-5a8c97f45008 . Liczba „9 zespołów" niepotwierdzona co do składu |
| Terminy i warunki kolejnej kohorty | [założenie] |
| ARP: reputacja ze stakingu, testnet, brak kontraktu na mainnecie | [wyciąg] https://github.com/Wieedze/ARP |
| Hive Mind: rozszerzenie z reputacją profili; Kylan Hurt | [wyciąg] https://hivemindhq.io/ |
| Human Passport, World ID: tarcie i progi | [wyciąg] https://support.passport.human.tech/stamps/stamp-weights |
| Buildery chcą dowodu zaufania i przyprowadzą użytkowników | [założenie] — test w sekcji 12 |
| Społeczność Intuition ma sieć i tTRUST | [założenie] — test w sekcji 12 |
| Zaufanie „bez gazu" blokuje wymóg zgody odbiorcy dla FeeProxy | [założenie] z kodu (`approve` w `intuition.ts:78`); kontraktu nie czytałem |
| Ceny i rozmiary w modelu biznesowym (0,002 USD za decyzję, 29–99 USD mies., liczba klientów) | [założenie] — rząd wielkości, nie prognoza |
| Koszt zaufania na mainnecie | [założenie] — do zmierzenia w Etapie 15 |
