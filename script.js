const { createApp } = Vue;

createApp({
    data() {
        return {
            gameStarted: false,
            loading: false,
            week: 1,
            year: 2026,
            feed: [],
            offer: null,
            p: {
                name: '', pos: 'ATA', ovr: 0, club: 'Base do Clube',
                wage: 1, marketValue: 0.5, energy: 100, injury: 0,
                stats: { Finalização: 60, Passe: 55, Velocidade: 65, Físico: 50 }
            },
            career: { goals: 0, apps: 0 }
        }
    },
    methods: {
        start() {
            if (!this.p.name) return alert("Dê um nome ao craque!");
            this.calculateOvr();
            this.gameStarted = true;
            this.addFeed("Carreira", `O mundo do futebol dá as boas-vindas a ${this.p.name}!`, "info");
            this.save();
        },

        calculateOvr() {
            const vals = Object.values(this.p.stats);
            this.p.ovr = Math.round(vals.reduce((a, b) => a + b) / vals.length);
            this.p.marketValue = parseFloat(((this.p.ovr * this.p.ovr) / 750).toFixed(1));
        },

        nextWeek() {
            if (this.p.energy < 20) return alert("Você está exausto! Descanse.");
            
            this.loading = true;
            setTimeout(() => {
                this.week++;
                this.career.apps++;
                this.p.energy -= 15;

                // Lógica de Simulação
                const performance = (this.p.ovr + (this.p.energy / 5)) / 2;
                const rng = Math.random() * 100;

                // 1. Chance de Lesão (baseada em energia baixa)
                if (this.p.energy < 40 && Math.random() < 0.1) {
                    this.p.injury = Math.floor(Math.random() * 4) + 1;
                    this.addFeed("Departamento Médico", `Você sofreu uma lesão muscular! Fora por ${this.p.injury} semanas.`, "injury");
                }

                // 2. Gols (Se não estiver lesionado)
                if (this.p.injury === 0 && rng < (performance / 1.5)) {
                    this.career.goals++;
                    this.addFeed("GOL!", `Atuação de gala! Você marcou no último jogo.`, "goal");
                    this.p.stats.Finalização += 0.3;
                }

                // 3. Evolução de Atributos e Recuperação
                if (this.p.injury > 0) {
                    this.p.injury--;
                    this.p.energy = Math.min(100, this.p.energy + 30);
                } else {
                    this.p.stats.Físico += 0.1;
                    this.p.stats.Passe += 0.05;
                }

                        // Mercado de Transferências (Janela na semana 20 e 40)
                        if ((this.week == 20 || this.week == 40) && Math.random() < 0.4) {
                            this.generateOffer();
                        }

                if (this.week > 40) {
                    this.week = 1;
                    this.year++;
                    this.p.energy = 100; // Férias
                }

                this.calculateOvr();
                this.loading = false;
                this.save();
            }, 600);
        },

        async generateOffer() {
            try {
                const resp = await fetch(`/api/market/offers?ovr=${encodeURIComponent(this.p.ovr)}&value=${encodeURIComponent(this.p.marketValue)}`);
                if (!resp.ok) return;
                const offers = await resp.json();
                if (!offers || offers.length === 0) return;
                // choose a random offer among server-generated ones
                const pick = offers[Math.floor(Math.random() * offers.length)];
                this.offer = { club: pick.club, wage: pick.wage, fee: pick.fee };
            } catch (e) {
                console.warn('Erro ao buscar ofertas:', e);
            }
        },

        async acceptOffer() {
            // inform server (best-effort) and update local state
            try {
                await fetch('/api/transfer/accept', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ club: this.offer.club, fee: this.offer.fee, wage: this.offer.wage })
                });
            } catch (e) {
                console.warn('Erro ao notificar servidor:', e);
            }
            this.addFeed("Mercado", `OFICIAL: ${this.p.name} assina com o ${this.offer.club}!`, "info");
            this.p.club = this.offer.club;
            this.p.wage = this.offer.wage;
            this.offer = null;
            this.save();
        },

        addFeed(title, text, type) {
            this.feed.unshift({ time: `S${this.week} Y${this.year}`, title, text, type });
            if (this.feed.length > 20) this.feed.pop();
        },

        save() { localStorage.setItem('foot_dynasty_v2', JSON.stringify(this.$data)); },
        load() {
            const saved = localStorage.getItem('foot_dynasty_v2');
            if (saved) Object.assign(this.$data, JSON.parse(saved));
        }
    },
    mounted() { this.load(); }
}).mount('#app');