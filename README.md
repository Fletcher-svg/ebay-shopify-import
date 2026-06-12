# eBay Product Image Extractor for Shopify

Projekt automatycznego systemu pobierania galerii zdjęć produktów z serwisu eBay na podstawie listy ID i konwertowania ich do ustandaryzowanego formatu CSV akceptowanego przez platformę Shopify.

## 📝 Opis zadania i problemu

### Główny cel:
Pobranie pełnych galerii zdjęć (głównych oraz dodatkowych) dla masowej listy produktów z serwisu eBay i przygotowanie struktury danych pod bezpośredni import do Shopify.

### Napotkane problemy podczas realizacji:
1. **Blokady anty-botowe (403 Forbidden):** Pierwsza faza projektu zakładała tradycyjny web scraping przy użyciu biblioteki `axios`. Systemy bezpieczeństwa eBaya natychmiast wykryły zautomatyzowany ruch masowy i zablokowały zapytania kodu `index.js`.
2. **Niestabilność selektorów HTML:** Analiza kodu źródłowego stron eBaya wykazała dużą zmienność struktury DOM w zależności od lokalizacji i typu aukcji, co dyskwalifikowało tradycyjne parsowanie jako rozwiązanie produkcyjne.
---

## Proces deweloperski i próby rozwiązania 

W celu zachowania czystości w historii systemu kontroli wersji (Git Flow), realizacja zadania została podzielona na logiczne etapy:

1. **Konfiguracja repozytorium:** 
   * Stworzenie pliku `.gitignore` i zabezpieczenie przed commitowaniem ciężkich katalogów systemowych (`node_modules`) oraz plików konfiguracyjnych.
2. **Inicjalizacja środowiska wejściowego:**
   * Stworzenie dedykowanego brancha deweloperskiego: `feature/init-input`.
   * Przygotowanie struktury tablicy wejściowej z listą ID produktów dostarczonych do testów.
3. **Instalacja bazowych pakietów:**
   * Pobranie podstawowych narzędzi do parsowania: `npm install axios cheerio`.
4. **Faza testów (Proof of Concept - PoC):**
   * Po zablokowaniu tradycyjnych zapytań HTTP, przeprowadzono testy mające na celu emulację zachowania użytkownika za pomocą biblioteki automatyzacji przeglądarek (**Puppeteer**). Testy wykazały, że renderowanie pełnego okna przeglądarki rozwiązuje problem blokad, jednak drastycznie obniża wydajność skryptu przy skali 5700 produktów i generuje ryzyko barier typu CAPTCHA.
---

## Ostateczne rozwiązanie

Aby zapewnić 100% stabilności bez ryzyka przerw w działaniu algorytmu i kosztów związanych z serwerami Proxy, projekt został całkowicie przepięty na **Oficjalne API eBaya**.

### Architektura systemu:
* **Integracja z eBay Buy Browse API:** Wykorzystano oficjalny, dedykowany endpoint produkcyjny: `buy/browse/v1/item/{item_id}` (metoda `getItem`). Pozwala on na błyskawiczne pobieranie czystych obiektów JSON zawierających tablice `image` oraz `additionalImages` bezpośrednio w rozdzielczości 1600px.
* **Bezpieczeństwo (OAuth Flow):** Zaimplementowano standard *OAuth Client Credentials Flow*. Skrypt dynamicznie generuje tymczasowy `access_token` autoryzujący zapytania API.
* **Zmienne Środowiskowe:** Do projektu doinstalowano pakiet `dotenv` (`npm install dotenv`). Wrażliwe dane dostępowe aplikacji (Client ID oraz Client Secret) zostały całkowicie odseparowane od kodu źródłowego i są wstrzykiwane z poziomu lokalnego pliku `.env`, który jest ignorowany przez Git.
* **Zgodność z Shopify CSV:** Skrypt automatycznie transformuje płaskie dane z API w relacyjną strukturę Shopify (identyczny `Handle` wiążący wiersze, nazwa produktu `Title` podawana wyłącznie przy pierwszym zdjęciu, dynamiczne indeksowanie `Image Position`).

---

##  Instrukcja uruchomienia

1. Posiadasz zainstalowane środowisko Node.js (v22 lub nowsze).
2. Zainstaluj wymagane zależności:
```bash
   npm install
```
3. Stwórz w głównym katalogu plik .env i uzupełnij go swoimi produkcyjnymi kluczami deweloperskimi eBay:
   EBAY_CLIENT_ID=TUTAJ_TWÓJ_APP_ID
   EBAY_CLIENT_SECRET=TUTAJ_TWÓJ_CERT_ID
4. Uruchom proces
```bash
  node index.js
```
Wynikowy plik raportu zostanie wygenerowany w katalogu głównym jako shopify_import.csv
