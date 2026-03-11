# 🔍 GitPulse — GitHub Analytics Dashboard

A powerful GitHub analytics dashboard built with React + Vite that lets you analyze any developer's profile and compare two users side by side.

🌐 **Live Demo:** https://github-analyst-lemon.vercel.app

---

## ✨ Features

- 📊 **Contribution Heatmap** — visualize yearly contribution activity
- ⭐ **Repo Analytics** — stars, forks, issues across all repos
- 🌐 **Language Breakdown** — see which languages a developer uses most
- 🏥 **Health Score** — overall developer profile score out of 100
- 📡 **Radar Chart** — visualize 5 health dimensions at once
- ⚔ **Compare Mode** — analyze two GitHub users side by side
- 🏆 **Head to Head** — see who wins across every metric

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- npm

### Installation

```bash
# Clone the repo
git clone https://github.com/palak-yadav01/github-analyst.git

# Go into the folder
cd github-analyst

# Install dependencies
npm install

# Start the dev server
npm run dev
Open http://localhost:5173 in your browser.
🔑 GitHub Token 
A token unlocks:
Contribution heatmap graph
Higher API rate limits (60 → 5000 requests/hour)
How to get one:
Go to GitHub → Settings → Developer Settings
Personal Access Tokens → Tokens (classic)
Generate new token with read:user and repo scopes
Paste it into the token field in the dashboard
🛠 Built With
Tech
Purpose
React + Vite
Frontend framework
Recharts
Charts and visualizations
GitHub REST API
Profile and repo data
GitHub GraphQL API
Contribution calendar
Vercel
Deployment
📸 Screenshots
Single User Analytics
Profile card with health score
Stat cards (repos, stars, forks, followers)
Contribution heatmap
Language distribution
Top repos table
Compare Mode
Head to Head stats panel
Side by side profile comparison
Blue vs Red color coding
📦 Deployment
# Build for production
npm run build

# Deploy to Vercel
vercel --prod
🤝 Contributing
Pull requests are welcome! For major changes please open an issue first.
📄 License
MIT License — feel free to use this project however you like.
Made with ❤️ by palak-yadav01