# Yuktha Gowda: portfolio

A playable portfolio. Visitors boot up an AI agent, steer it through a circuit-board maze to unlock resume chapters, fling through draggable project cards, see how many people are on the site live, and leave a drawing on a shared guestbook wall.

Plain HTML, CSS and JavaScript. No build step.

## Files

| File | What it does |
| --- | --- |
| `index.html` | Page structure |
| `styles.css` | All styling |
| `data.js` | **Your resume content.** Edit this to update jobs, projects and skills |
| `cast.js` | The characters (Agent and the three bugs) and the eyes that follow the cursor |
| `main.js` | Boot intro, cards, draggable strips, copy-email button |
| `game.js` | The maze game |
| `live.js` | Live visitor counter and guestbook (Supabase) |
| `config.js` | Your Supabase keys go here |
| `supabase.sql` | Database setup, run once |
| `supabase-arcade.sql` | Leaderboard and bug counter, run once after `supabase.sql` |
| `bugs.js` | Bugs that crawl across the page |
| `arcade.js` | The arcade switcher plus Hallucination or Fact? and Injection Defense |
| `vending.js` | The Yuktha-o-matic vending machine. Edit `CAPSULES` to change what’s inside |
| `contact.js` | The `send_email(...)` tool-call contact section |

## Run it locally

Open the folder in VS Code, install the **Live Server** extension, right-click `index.html` and choose **Open with Live Server**. (Double-clicking the file also works, but Live Server reloads as you edit.)

## Turn on the live counter and guestbook (about 10 minutes)

Without this step the site works fine; the counter and the guestbook section simply stay hidden.

1. Create a free account at supabase.com and click **New project**. Pick any name and a strong database password, and choose the region closest to you (East US).
2. When it's ready, open **SQL Editor**, click **New query**, paste everything from `supabase.sql`, and click **Run**.
3. Go to **Project Settings > API**. Copy the **Project URL** and the **anon public** key.
4. Paste them into `config.js`:
   ```js
   window.SUPABASE_URL = "https://xxxx.supabase.co";
   window.SUPABASE_ANON_KEY = "eyJ...";
   ```
5. Reload the page. You'll see the "here now" counter in the header and the **Leave your mark** wall near the bottom. Open the site in two browser windows to watch both update live.

The anon key is designed to be public. The policies in `supabase.sql` only let visitors read the wall and add new drawings; nobody can edit or delete anything except you. To remove a drawing, open **Table Editor > guestbook** in Supabase and delete the row. The site also limits each visitor to one post per minute.

## Put it online with Vercel

1. Create a new GitHub repository (for example `portfolio`) and push this folder to it:
   ```bash
   git init
   git add .
   git commit -m "Portfolio v1"
   git branch -M main
   git remote add origin https://github.com/<your-username>/portfolio.git
   git push -u origin main
   ```
2. Go to vercel.com, sign in with GitHub, click **Add New > Project**, and import the repository.
3. Framework preset: **Other**. Leave build settings empty. Click **Deploy**.
4. Optional: in the project's **Settings > Domains**, add a custom domain such as `yukthagowda.dev`.

Every `git push` to `main` redeploys the site automatically.

## Ideas for making it yours

- Add a "Code" link on each project card pointing to its GitHub repo (add a `link` field in `data.js` and render it in `main.js`).
- Add a short demo GIF of the Causal Design Agent as that card's cover instead of the generated art.
- Track how many people beat the game by adding a `wins` table in Supabase.

## Version 2 features

**Leaderboard and global bug counter:** run `supabase-v2.sql` in the Supabase SQL Editor once.

**Live cursors:** nothing to set up. They use the same Supabase connection as the visitor counter.

## Version 3: the fun update

- **Permission gate:** visitors approve `show_portfolio()` like an agent tool call. Try clicking Deny a few times.
- **Career as a run trace:** each job is a span with inputs, outputs and a timeline bar. Edit the `SPANS` list at the top of `lab.js` to change the fun inputs and outputs.
- **The lab:** a BM25 retrieval playground over the resume, the Causal Design Agent workflow with validators (edit `STAGES` in `lab.js` to match your real stage names), and a threshold slider for the autoimmune model.
- **Contact as a tool call:** `send_email(...)` with editable arguments and a Run button.

## Version 4: the arcade

The game section is now an arcade with three cartridges, each with its own leaderboard:

- **Maze run:** the original game.
- **Hallucination or Fact?:** 10 claims about you, 8 seconds each, true or hallucinated. Edit the `CLAIMS` list in `arcade.js` to add your own (keep the true ones accurate).
- **Injection Defense:** block prompt injections, let real requests through. Edit `SAFE` and `BAD` in `arcade.js` to change the messages.

Run `supabase-v3.sql` once in the Supabase SQL Editor so the leaderboard can save scores for the new games.

## Version 5: the Yuktha-o-matic

The lab is replaced by a vending machine. Visitors insert a coin, pick a slot and open a capsule with a fact about Yuktha. Edit the `CAPSULES` list at the top of `vending.js` to change the capsules. `soldOut: true` makes a joke slot, `golden: true` makes the rare one.
