/* Bouffe — données et logique (sans DOM). Fonctionne dans le navigateur (window.Core) et sous Node (tests). */
(function (root) {
  "use strict";

  // ---------- Types de produits ----------
  // [clé, nom, emoji, lieu, jours de conservation, jours après ouverture (0 = sans objet), groupe, drapeaux, catégories Open Food Facts (regex)]
  // drapeaux : v = bouton rapide (vrac)  f = acheté en frais (liste appoint)  z = se congèle  a = d'origine animale  m = viande/poisson
  // L'ordre compte : pour une même catégorie OFF, le premier type qui correspond gagne (du plus précis au plus général).
  const RAW = [
    // Légumes
    ["tomate", "Tomates", "🍅", "frigo", 6, 0, "legume", "vf", /^(tomatoes|cherry-tomatoes|fresh-tomatoes)$/],
    ["courgette", "Courgettes", "🥒", "frigo", 7, 0, "legume", "vfz", /^(zucchini|courgettes?)$/],
    ["poivron", "Poivrons", "🫑", "frigo", 8, 0, "legume", "vfz", /^(bell-peppers|sweet-peppers|peppers)$/],
    ["aubergine", "Aubergines", "🍆", "frigo", 6, 0, "legume", "vf", /^(eggplants|aubergines)$/],
    ["carotte", "Carottes", "🥕", "frigo", 21, 0, "legume", "vfzu", /^carrots$/],
    ["poireau", "Poireaux", "🥬", "frigo", 10, 0, "legume", "vfz", /^leeks$/],
    ["salade", "Salade", "🥗", "frigo", 4, 0, "legume", "vf", /^(lettuces?|salads|leaf-salads|mixed-salads|lamb-s-lettuce|rocket)$/],
    ["epinards", "Épinards", "🍃", "frigo", 3, 0, "legume", "vfz", /^(spinach|spinaches|fresh-spinach)$/],
    ["champignons", "Champignons", "🍄", "frigo", 4, 0, "legume", "vfz", /^(mushrooms|button-mushrooms|cultivated-mushrooms)$/],
    ["brocoli", "Brocoli", "🥦", "frigo", 5, 0, "legume", "vfz", /^broccoli$/],
    ["chou_fleur", "Chou-fleur", "🥦", "frigo", 7, 0, "legume", "vfz", /^cauliflowers?$/],
    ["chou", "Chou", "🥬", "frigo", 21, 0, "legume", "vf", /^(cabbages?|green-cabbages|red-cabbages)$/],
    ["haricots_verts", "Haricots verts", "🫛", "frigo", 4, 0, "legume", "vfz", /^green-beans$/],
    ["concombre", "Concombre", "🥒", "frigo", 6, 0, "legume", "vf", /^cucumbers?$/],
    ["fenouil", "Fenouil", "🌿", "frigo", 7, 0, "legume", "vf", /^fennels?$/],
    ["radis", "Radis", "🌶️", "frigo", 5, 0, "legume", "vf", /^radish(es)?$/],
    ["betterave", "Betteraves cuites", "🟣", "frigo", 7, 3, "legume", "vf", /^(beetroots?|cooked-beetroots)$/],
    ["herbes", "Herbes fraîches", "🌿", "frigo", 5, 0, "legume", "vfz", /^(fresh-herbs|parsley|coriander|basil|chives|mint)$/],
    ["pomme_de_terre", "Pommes de terre", "🥔", "placard", 30, 0, "legume", "vfu", /^(potatoes|fresh-potatoes)$/],
    ["patate_douce", "Patates douces", "🍠", "placard", 21, 0, "legume", "vf", /^sweet-potatoes$/],
    ["courge", "Courge / potiron", "🎃", "placard", 60, 0, "legume", "vfz", /^(squashes|pumpkins|butternut-squash|winter-squashes)$/],
    ["oignon", "Oignons", "🧅", "placard", 30, 0, "legume", "vfu", /^(onions|shallots|red-onions|yellow-onions)$/],
    ["ail", "Ail", "🧄", "placard", 60, 0, "legume", "vfu", /^garlic$/],
    ["avocat", "Avocats", "🥑", "placard", 5, 0, "legume", "vf", /^avocados?$/],
    ["citron", "Citrons", "🍋", "frigo", 21, 0, "fruit", "vfu", /^(lemons|limes)$/],
    // Fruits
    ["pomme", "Pommes", "🍎", "frigo", 21, 0, "fruit", "vf", /^(apples|fresh-apples)$/],
    ["poire", "Poires", "🍐", "frigo", 7, 0, "fruit", "vf", /^pears$/],
    ["banane", "Bananes", "🍌", "placard", 5, 0, "fruit", "vfz", /^bananas$/],
    ["orange", "Oranges", "🍊", "placard", 14, 0, "fruit", "vf", /^(oranges|clementines|mandarins|tangerines|citrus)$/],
    ["kiwi", "Kiwis", "🥝", "placard", 14, 0, "fruit", "vf", /^kiwis?$/],
    ["raisin", "Raisin", "🍇", "frigo", 5, 0, "fruit", "vf", /^grapes$/],
    ["fruits_rouges", "Fruits rouges", "🍓", "frigo", 3, 0, "fruit", "vfz", /^(strawberries|raspberries|blueberries|berries|red-fruits)$/],
    ["fruit", "Autres fruits", "🍑", "frigo", 6, 0, "fruit", "vf", /^(fresh-fruits|fruits)$/],
    // Crèmerie, œufs
    ["oeufs", "Œufs", "🥚", "frigo", 28, 0, "oeuf", "vfau", /^(eggs|chicken-eggs|free-range-eggs|organic-eggs)$/],
    ["yaourt_vegetal", "Yaourts végétaux", "🥥", "frigo", 21, 3, "laitier", "f", /^(plant-based-yogurts|soy-yogurts|non-dairy-yogurts|fermented-plant-based|plant-based-fermented-foods|coconut-yogurts)/],
    ["yaourt", "Yaourts", "🥛", "frigo", 21, 3, "laitier", "vfa", /^(yogurts|plain-yogurts|fruit-yogurts|greek-yogurts|fermented-milk-products|dairy-desserts|desserts-lactes|cottage-cheeses|fromages-blancs|petits-suisses|quark)/],
    ["lait_vegetal", "Lait végétal", "🌾", "placard", 180, 5, "laitier", "", /^(plant-milks|plant-based-milks|soy-milks|oat-milks|almond-milks|rice-milks|non-dairy-milk|plant-based-beverages|milk-substitutes)/],
    ["lait", "Lait", "🥛", "placard", 90, 4, "laitier", "au", /^(milks|uht-milks|semi-skimmed-milks|whole-milks|skimmed-milks|cow-milks)$/],
    ["creme_vegetale", "Crème végétale", "🥥", "placard", 180, 4, "laitier", "", /^(plant-based-creams|soy-creams|oat-creams|cream-substitutes|plant-based-cooking-creams)/],
    ["creme", "Crème fraîche", "🍶", "frigo", 21, 5, "laitier", "fa", /^(creams|fresh-creams|creme-fraiche|cooking-creams|sour-creams|heavy-creams|liquid-creams|whipping-creams)/],
    ["beurre", "Beurre", "🧈", "frigo", 60, 30, "laitier", "fzau", /^(butters?|salted-butters|unsalted-butters|semi-salted-butters|dairy-spreads)$/],
    ["margarine", "Margarine", "🧈", "frigo", 60, 30, "laitier", "fu", /^(margarines?|plant-based-spreads|vegetable-fat-spreads|spreadable-fats)/],
    ["fromage_rape", "Fromage râpé", "🧀", "frigo", 21, 7, "laitier", "fzau", /^(grated-cheeses|shredded-cheeses|grated-emmental|grated-parmesan|parmigiano-reggiano-grated)/],
    ["mozzarella", "Mozzarella", "🧀", "frigo", 14, 3, "laitier", "fa", /^(mozzarella|mozzarellas|burrata)/],
    ["feta", "Feta", "🧀", "frigo", 30, 7, "laitier", "fa", /^(feta|fetas|feta-cheeses)/],
    ["fromage_frais", "Fromage frais / chèvre", "🧀", "frigo", 14, 5, "laitier", "fa", /^(fresh-cheeses|cream-cheeses|goat-cheeses|fresh-goat-cheeses|ricotta|spreadable-cheeses)/],
    ["fromage", "Fromage", "🧀", "frigo", 21, 10, "laitier", "vfzau", /^(cheeses|hard-cheeses|french-cheeses|cow-cheeses|pressed-cheeses|soft-cheeses|blue-cheeses|emmentals?|comtes?|raclette|camemberts?|brie|cheddars?|goudas?|parmigiano-reggiano)/],
    // Protéines
    ["tofu", "Tofu", "⬜", "frigo", 30, 4, "proteine", "fz", /^(tofu|tofus|smoked-tofu|silken-tofu|tempeh|seitan)/],
    ["steak_vegetal", "Steaks / galettes végé", "🌱", "frigo", 14, 2, "proteine", "fz", /^(meat-analogues|meat-alternatives|vegetarian-burgers|plant-based-burgers|veggie-burgers|vegetable-patties|vegetarian-sausages|vegan-sausages|plant-based-meat|falafels?)/],
    ["jambon", "Jambon", "🍖", "frigo", 7, 3, "viande", "vfzam", /^(hams|cooked-hams|white-hams|cured-hams|prepared-meats|poultry-hams)/],
    ["lardons", "Lardons", "🥓", "frigo", 14, 4, "viande", "fzam", /^(lardons|bacon|bacons|smoked-bacon|pork-belly)/],
    ["saucisse", "Saucisses", "🌭", "frigo", 7, 2, "viande", "vfzam", /^(sausages|frankfurters|knacks|merguez|chipolatas|toulouse-sausages|strasbourg-sausages)/],
    ["poulet", "Poulet / volaille", "🍗", "frigo", 3, 0, "viande", "vfzam", /^(chickens?|chicken-breasts|chicken-meat|poultries|poultry-meat|turkey|turkeys|chicken-fillets|chicken-cutlets)/],
    ["viande_hachee", "Viande hachée", "🥩", "frigo", 2, 0, "viande", "vfzam", /^(ground-beef|minced-meat|ground-meat|minced-beef|beef-patties|hamburgers?)/],
    ["viande", "Viande", "🥩", "frigo", 3, 0, "viande", "vfzam", /^(meats|beef|beefs|pork|porks|veal|lamb|lambs|steaks)/],
    ["saumon_fume", "Saumon fumé", "🐟", "frigo", 14, 3, "poisson", "fzam", /^(smoked-salmons?|smoked-fishes|smoked-trout)/],
    ["thon", "Thon en boîte", "🐟", "placard", 1000, 2, "poisson", "am", /^(canned-tunas?|tunas?|tuna-in-water|tuna-in-oil|canned-fishes|sardines|canned-sardines|mackerels)/],
    ["poisson_pane", "Poisson pané", "🐠", "congel", 365, 0, "poisson", "am", /^(breaded-fish|fish-sticks|fish-fingers|breaded-fish-fillets)/],
    ["poisson", "Poisson", "🐟", "frigo", 2, 0, "poisson", "vfzam", /^(fishes|fish-fillets|fresh-fish|salmons?|cods?|seafood|prawns|shrimps)$/],
    // Féculents
    ["pates_fraiches", "Pâtes fraîches / gnocchis", "🥟", "frigo", 20, 2, "feculent", "fz", /^(fresh-pastas?|gnocchi|gnocchis|potato-gnocchi|ravioli|raviolis|tortellini|filled-pastas|stuffed-pastas)/],
    ["pate_tarte", "Pâte à tarte / pizza", "🥧", "frigo", 20, 0, "feculent", "fz", /^(pastry-doughs?|pie-doughs?|puff-pastr|shortcrust-pastr|pizza-doughs?|ready-to-roll|doughs)/],
    ["pates", "Pâtes", "🍝", "placard", 700, 0, "feculent", "", /^(pastas|dry-pastas|dried-pastas|durum-wheat-pastas?|spaghetti|macaroni|penne|fusilli|tagliatelle|lasagna|lasagne|noodles|egg-pastas?|coquillettes|farfalle|whole-wheat-pastas?)/],
    ["riz", "Riz", "🍚", "placard", 700, 0, "feculent", "", /^(rices|white-rices|basmati-rices?|long-grain-rices|thai-rices|risotto-rices|brown-rices|whole-grain-rices|jasmine-rice)/],
    ["semoule", "Semoule / boulgour", "🌾", "placard", 700, 0, "feculent", "", /^(semolinas?|couscous|durum-wheat-semolinas?|bulgur|bulgurs)/],
    ["quinoa", "Quinoa", "🌾", "placard", 700, 0, "feculent", "", /^(quinoa|quinoas)/],
    ["lentilles", "Lentilles", "🫘", "placard", 700, 0, "feculent", "", /^(lentils|green-lentils|red-lentils|coral-lentils|dried-lentils|split-peas)/],
    ["pois_chiches", "Pois chiches", "🫘", "placard", 1000, 3, "feculent", "", /^(chickpeas|canned-chickpeas|cooked-chickpeas)/],
    ["haricots_rouges", "Haricots rouges / blancs", "🫘", "placard", 1000, 3, "feculent", "", /^(red-kidney-beans|kidney-beans|canned-beans|white-beans|canned-red-beans|beans|black-beans|cooked-beans)/],
    ["tortillas", "Tortillas / wraps", "🌯", "placard", 45, 7, "feculent", "", /^(tortillas|wraps|flatbreads|wheat-tortillas)/],
    ["pain_de_mie", "Pain de mie", "🍞", "placard", 15, 5, "feculent", "z", /^(sandwich-breads|sliced-breads|white-sandwich-breads|toast-breads|brioches?)/],
    ["pain", "Pain", "🥖", "placard", 3, 0, "feculent", "vfz", /^(breads|baguettes|fresh-breads|country-breads|special-breads)$/],
    ["farine", "Farine", "🌾", "placard", 365, 0, "epicerie", "", /^(flours|wheat-flours|cereal-flours)/],
    ["flocons", "Flocons d'avoine / céréales", "🥣", "placard", 300, 60, "epicerie", "", /^(breakfast-cereals|rolled-oats|oat-flakes|cereal-flakes|mueslis?|granolas?|chocolate-cereals)/],
    // Épicerie
    ["tomates_concassees", "Tomates en conserve / coulis", "🥫", "placard", 700, 4, "epicerie", "", /^(canned-tomatoes|tomato-sauces|tomato-purees|crushed-tomatoes|diced-tomatoes|peeled-tomatoes|tomato-pulps|passata|tomato-concentrates|tomato-pastes)/],
    ["sauce_pates", "Sauce / pesto", "🫙", "placard", 365, 5, "epicerie", "", /^(pasta-sauces|pestos?|bolognese-sauces|sauces)/],
    ["lait_coco", "Lait de coco", "🥥", "placard", 700, 3, "epicerie", "", /^(coconut-milks|coconut-creams)/],
    ["mais", "Maïs", "🌽", "placard", 1000, 3, "epicerie", "", /^(sweet-corn|corn|canned-corn|canned-sweet-corn)/],
    ["legumes_conserve", "Légumes en conserve", "🥫", "placard", 1000, 3, "epicerie", "", /^(canned-vegetables|canned-green-beans|canned-peas|peas-and-carrots|canned-mushrooms|canned-legumes)/],
    ["soupe", "Soupe toute prête", "🍲", "placard", 300, 3, "epicerie", "", /^(soups|vegetable-soups|velvety-soups|veloutes)/],
    ["bouillon", "Bouillon cube", "🧊", "placard", 700, 0, "epicerie", "", /^(broths|stock-cubes|bouillon-cubes|vegetable-broths)/],
    ["huile", "Huile", "🫒", "placard", 365, 0, "epicerie", "", /^(vegetable-oils|olive-oils|extra-virgin-olive-oils|sunflower-oils|rapeseed-oils|oils)/],
    ["vinaigre", "Vinaigre / moutarde", "🫙", "placard", 700, 0, "epicerie", "", /^(vinegars|mustards|dijon-mustards|condiments)/],
    ["epices", "Épices / sel", "🧂", "placard", 700, 0, "epicerie", "", /^(spices|salts|peppers-spice|curry|herbs-and-spices|seasonings|condiment-mixes)/],
    ["sucre", "Sucre", "🍬", "placard", 1000, 0, "epicerie", "", /^(sugars|white-sugars|brown-sugars|cane-sugars|powdered-sugars)/],
    ["miel", "Miel / confiture", "🍯", "placard", 700, 60, "epicerie", "a", /^(honeys|jams|fruit-jams|marmalades|spreads|sweet-spreads|hazelnut-spreads|cocoa-and-hazelnuts-spreads)/],
    ["chocolat", "Chocolat", "🍫", "placard", 365, 0, "epicerie", "", /^(chocolates|dark-chocolates|milk-chocolates|chocolate-bars|cocoa-powders|cocoa)/],
    ["biscuits", "Biscuits / gâteaux", "🍪", "placard", 180, 14, "epicerie", "", /^(biscuits|cookies|biscuits-and-cakes|cakes|sweet-snacks|madeleines|crackers|shortbread)/],
    ["compote", "Compotes", "🍏", "placard", 365, 4, "epicerie", "", /^(compotes|apple-compotes|fruit-purees|applesauces)/],
    ["aperitif", "Chips / apéritif", "🥨", "placard", 120, 7, "epicerie", "", /^(chips|crisps|potato-crisps|salty-snacks|appetizers|nuts|peanuts|olives)/],
    ["jus", "Jus de fruits", "🧃", "placard", 270, 5, "boisson", "", /^(fruit-juices|orange-juices|apple-juices|juices|nectars|fruit-based-beverages)/],
    ["cafe", "Café / thé", "☕", "placard", 365, 0, "boisson", "", /^(coffees|ground-coffees|coffee-capsules|coffee-pods|instant-coffees|teas|green-teas|herbal-teas|infusions)/],
    ["boisson", "Boissons", "🥤", "placard", 365, 4, "boisson", "", /^(beverages|sodas|waters|mineral-waters|spring-waters|carbonated-drinks|beers|wines)/],
    // Surgelés
    ["legumes_surgeles", "Légumes surgelés", "🧊", "congel", 365, 0, "surgele", "", /^(frozen-vegetables|frozen-green-beans|frozen-peas|frozen-spinach|frozen-vegetable-mixes|frozen-broccoli)/],
    ["frites", "Frites / potatoes", "🍟", "congel", 365, 0, "surgele", "", /^(frozen-fries|french-fries|frozen-potatoes|potato-wedges|frozen-french-fries)/],
    ["pizza", "Pizza / plat surgelé", "🍕", "congel", 365, 0, "surgele", "", /^(frozen-pizzas|pizzas|frozen-ready-made-meals|frozen-meals)/],
    ["glace", "Glaces", "🍨", "congel", 365, 0, "surgele", "a", /^(ice-creams|frozen-desserts|sorbets|ice-cream-tubs)/],
    ["plat_prepare", "Plat préparé", "🍱", "frigo", 5, 2, "autre", "f", /^(meals|prepared-meals|ready-made-meals|salads-prepared|pizzas-pies-and-quiches|quiches)/],
    ["autre", "Autre", "📦", "placard", 60, 0, "autre", "", null],
  ];

  const TYPES = {};
  const TYPE_LIST = RAW.map(r => {
    const t = { k: r[0], n: r[1], e: r[2], p: r[3], d: r[4], o: r[5], g: r[6],
      vrac: r[7].includes("v"), fresh: r[7].includes("f"), freeze: r[7].includes("z"),
      animal: r[7].includes("a"), meat: r[7].includes("m"), multi: r[7].includes("u"), off: r[8] };
    TYPES[t.k] = t;
    return t;
  });

  const GROUPS = [
    ["legume", "Légumes"], ["fruit", "Fruits"], ["oeuf", "Œufs"], ["laitier", "Crèmerie"],
    ["proteine", "Protéines végé"], ["viande", "Viande"], ["poisson", "Poisson"],
    ["feculent", "Féculents & pain"], ["epicerie", "Épicerie"], ["boisson", "Boissons"],
    ["surgele", "Surgelés"], ["autre", "Autre"],
  ];
  const PLACES = { frigo: "Frigo", congel: "Congélo", placard: "Placards" };

  // ---------- Dates ----------
  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parse(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
  function today(now) { return iso(now || new Date()); }
  function addDays(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function diffDays(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); } // b - a
  const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  function dayLabel(s, ref) {
    const n = diffDays(ref, s);
    if (n === 0) return "Ce soir";
    if (n === 1) return "Demain";
    const d = parse(s);
    return JOURS[d.getDay()] + " " + d.getDate() + " " + MOIS[d.getMonth()];
  }
  function leftLabel(n) {
    if (n < 0) return n === -1 ? "dépassé d'1 jour" : "dépassé de " + (-n) + " j";
    if (n === 0) return "aujourd'hui";
    if (n === 1) return "demain";
    if (n < 60) return "J-" + n;
    if (n < 365) return Math.round(n / 30) + " mois";
    return "+ d'1 an";
  }

  // ---------- Correspondance Open Food Facts ----------
  function clean(tag) { return String(tag).replace(/^[a-z]{2}:/, "").toLowerCase(); }

  // Renvoie { t, place, days, frozen } à partir des catégories OFF (ordre : général -> précis)
  function matchCategories(tags) {
    const list = (tags || []).map(clean);
    const frozen = list.some(x => x === "frozen-foods" || x.startsWith("frozen-"));
    const canned = list.some(x => x === "canned-foods" || x.startsWith("canned-"));
    let found = null;
    for (let i = list.length - 1; i >= 0 && !found; i--) {
      for (const t of TYPE_LIST) {
        if (t.off && t.off.test(list[i])) { found = t; break; }
      }
    }
    if (!found) {
      // repli sur des familles larges
      const has = re => list.some(x => re.test(x));
      if (frozen) found = TYPES.pizza;
      else if (has(/^(vegetables|fresh-vegetables)$/)) found = TYPES.legumes_conserve;
      else if (has(/^dairies$|^dairy/)) found = TYPES.yaourt;
      else if (has(/^meats?$/)) found = TYPES.viande;
      else if (has(/^(snacks|sweet-snacks|confectioneries)$/)) found = TYPES.biscuits;
    }
    if (!found) return null;
    let place = found.p, days = found.d;
    if (frozen && found.p !== "congel") { place = "congel"; days = 270; }
    else if (canned && found.p === "frigo" && found.g !== "laitier") { place = "placard"; days = 900; }
    if (list.includes("fresh-milks") || list.includes("pasteurised-milks") || list.includes("pasteurized-milks")) { place = "frigo"; days = 8; }
    return { t: found.k, place, days, frozen };
  }

  function vegOf(analysisTags) {
    const a = (analysisTags || []).map(clean);
    if (a.includes("vegan")) return "vegan";
    if (a.includes("vegetarian")) return "vege";
    if (a.includes("non-vegan") && !a.includes("non-vegetarian") && !a.includes("maybe-vegetarian") && !a.includes("vegetarian-status-unknown")) return "vege";
    if (a.includes("non-vegetarian")) return "viande";
    return "";
  }

  // Transforme la réponse OFF en fiche produit
  function productFromOFF(code, json) {
    if (!json || json.status !== 1 || !json.product) return null;
    const p = json.product;
    const name = (p.product_name_fr || p.product_name || p.generic_name_fr || "").trim();
    const m = matchCategories(p.categories_tags);
    return {
      code, name: name || null,
      brand: (p.brands || "").split(",")[0].trim(),
      qty: (p.quantity || "").trim(),
      img: p.image_front_small_url || p.image_small_url || "",
      nutri: /^[a-e]$/.test(p.nutriscore_grade || "") ? p.nutriscore_grade : "",
      veg: vegOf(p.ingredients_analysis_tags),
      t: m ? m.t : null, place: m ? m.place : null, days: m ? m.days : null,
    };
  }

  // ---------- Stock ----------
  let _id = 0;
  function uid() { return Date.now().toString(36) + (++_id).toString(36) + Math.random().toString(36).slice(2, 5); }

  function newItem(t, opts, ref) {
    const T = TYPES[t] || TYPES.autre;
    opts = opts || {};
    const place = opts.place || T.p;
    const days = opts.days != null ? opts.days : (place === "congel" && T.p !== "congel" ? 90 : T.d);
    return {
      id: uid(), t: T.k, name: opts.name || "", brand: opts.brand || "", code: opts.code || "",
      img: opts.img || "", veg: opts.veg || "", nutri: opts.nutri || "",
      place, added: ref, exp: addDays(ref, days), opened: false, low: false,
    };
  }
  function displayName(it) { return it.name || (TYPES[it.t] || TYPES.autre).n; }
  function daysLeft(it, ref) { return diffDays(ref, it.exp); }

  function openItem(it, ref) {
    const T = TYPES[it.t] || TYPES.autre;
    it.opened = true;
    if (T.o && it.place !== "congel") { const lim = addDays(ref, T.o); if (lim < it.exp) it.exp = lim; }
  }
  function freezeItem(it, ref) {
    it.place = "congel";
    const lim = addDays(ref, 90);
    it.exp = lim;
  }

  // Produits à surveiller : tout ce qui périme dans `horizon` jours (hors congélateur sauf périmé)
  function priority(items, ref, horizon) {
    horizon = horizon == null ? 7 : horizon;
    return items
      .map(it => ({ it, n: daysLeft(it, ref) }))
      .filter(x => x.n <= horizon && (x.it.place !== "congel" || x.n <= 7))
      .sort((a, b) => a.n - b.n);
  }

  // ---------- Recettes (dîners, base végé, protéine en option) ----------
  // ing : liste d'emplacements ; chaque emplacement = clé de type ou "a|b|c" (l'un ou l'autre)
  // opt : ingrédients facultatifs (bonus s'ils sont là) ; prot : protéine proposée à part pour ceux qui en veulent
  const R = (id, n, e, min, ing, opt, prot, how) => ({ id, n, e, min, ing, opt: opt || [], prot: prot || "", how });
  const RECIPES = [
    R("pates_tomate", "Pâtes sauce tomate aux légumes", "🍝", 25, ["pates", "tomates_concassees|sauce_pates", "courgette|poivron|aubergine|champignons|legumes_surgeles"], ["oignon", "ail", "fromage_rape"], "lardons|jambon|viande_hachee", "Faire revenir les légumes, ajouter la tomate, laisser mijoter 10 min et mélanger aux pâtes."),
    R("gratin_pates", "Gratin de pâtes", "🧀", 35, ["pates", "creme|lait|creme_vegetale", "fromage_rape"], ["brocoli", "champignons", "epinards"], "jambon|lardons", "Pâtes à peine cuites, crème, légumes, fromage dessus, 20 min au four à 200 °C."),
    R("pates_creme_champi", "Pâtes crème et champignons", "🍄", 20, ["pates", "champignons", "creme|creme_vegetale"], ["ail", "oignon", "herbes"], "lardons|poulet", "Champignons poêlés avec ail et oignon, crème, poivre, sur les pâtes."),
    R("pates_poireaux", "Pâtes à la fondue de poireaux", "🥬", 25, ["pates", "poireau", "creme|creme_vegetale"], ["fromage_rape"], "saumon_fume|lardons", "Poireaux émincés fondus 15 min au beurre ou à l'huile, crème, sur les pâtes."),
    R("pates_brocoli", "Pâtes brocoli, ail et citron", "🥦", 20, ["pates", "brocoli", "ail"], ["citron", "fromage_rape"], "saucisse|thon", "Cuire le brocoli avec les pâtes, sauter à l'huile d'olive et à l'ail, zeste de citron."),
    R("lasagnes_leg", "Lasagnes aux légumes", "🍝", 60, ["pates", "tomates_concassees", "courgette|epinards|aubergine|champignons", "fromage_rape"], ["mozzarella", "fromage_frais", "oignon"], "viande_hachee", "Alterner pâtes, sauce tomate aux légumes et fromage, 40 min au four à 180 °C."),
    R("gnocchis_poeles", "Gnocchis poêlés aux légumes", "🥟", 20, ["pates_fraiches", "epinards|champignons|courgette|tomate|poivron"], ["creme", "fromage_rape", "ail"], "lardons|jambon", "Dorer les gnocchis à la poêle, ajouter les légumes, un peu de crème ou de fromage."),
    R("curry_pois_chiches", "Curry de pois chiches au lait de coco", "🍛", 30, ["pois_chiches", "lait_coco", "oignon", "riz"], ["epinards", "tomates_concassees", "tomate", "patate_douce", "ail"], "poulet", "Oignon, épices curry, pois chiches, tomate et lait de coco, 15 min. Servir avec le riz."),
    R("dahl", "Dahl de lentilles corail", "🫘", 30, ["lentilles", "lait_coco|tomates_concassees", "oignon", "riz"], ["ail", "carotte", "epinards", "citron"], "", "Lentilles cuites 20 min avec oignon, épices et lait de coco. Avec du riz."),
    R("chili", "Chili sin carne", "🌶️", 35, ["haricots_rouges", "tomates_concassees", "oignon", "riz|tortillas"], ["mais", "poivron", "avocat", "fromage_rape"], "viande_hachee", "Oignon, poivron, épices, haricots et tomate, 20 min. Avec du riz ou en wraps."),
    R("tortilla_esp", "Tortilla de pommes de terre", "🥚", 35, ["oeufs", "pomme_de_terre", "oignon"], ["salade", "poivron"], "saucisse|jambon", "Pommes de terre et oignon fondus à la poêle, œufs battus par-dessus, cuire doucement."),
    R("quiche_leg", "Quiche aux légumes", "🥧", 50, ["pate_tarte", "oeufs", "creme|lait", "poireau|epinards|courgette|champignons|brocoli|tomate"], ["fromage_rape", "fromage_frais", "salade"], "lardons|jambon|saumon_fume", "3 œufs + crème, légumes revenus, fromage, 35 min au four à 180 °C."),
    R("tarte_tomate", "Tarte fine tomate-mozza", "🍅", 35, ["pate_tarte", "tomate", "mozzarella|fromage_frais|feta"], ["herbes", "salade"], "jambon", "Pâte, moutarde, tomates en rondelles, fromage, 25 min à 200 °C."),
    R("pizza_maison", "Pizza maison", "🍕", 30, ["pate_tarte", "tomates_concassees", "mozzarella|fromage_rape"], ["champignons", "poivron", "oignon", "tomate"], "jambon|saucisse", "Pâte, sauce tomate, garnitures, fromage, 15 à 20 min à 220 °C."),
    R("fondue_poireaux_pdt", "Poireaux fondus et pommes de terre", "🥔", 35, ["poireau", "pomme_de_terre", "creme|creme_vegetale"], ["fromage_rape"], "poisson|saumon_fume|saucisse", "Poireaux fondus à la crème, pommes de terre vapeur, gratiner si on veut."),
    R("soupe_leg", "Soupe de légumes et tartines", "🍲", 35, ["carotte|poireau|courge|courgette|brocoli|chou_fleur", "pomme_de_terre|patate_douce", "pain|pain_de_mie"], ["oignon", "bouillon", "fromage", "fromage_frais"], "jambon", "Légumes en morceaux, bouillon, 25 min, mixer. Tartines grillées au fromage."),
    R("veloute_courge", "Velouté de courge et tartines", "🎃", 35, ["courge", "oignon", "pain|pain_de_mie"], ["creme", "lait_coco", "bouillon", "fromage_frais"], "lardons", "Courge et oignon dans le bouillon 25 min, mixer avec crème ou lait de coco."),
    R("risotto", "Risotto aux champignons", "🍚", 35, ["riz", "champignons", "oignon", "fromage_rape"], ["bouillon", "creme", "herbes"], "poulet", "Nacrer le riz avec l'oignon, ajouter le bouillon louche par louche, champignons et parmesan à la fin."),
    R("riz_saute", "Riz sauté aux légumes et œufs", "🍳", 20, ["riz", "oeufs", "carotte|poivron|legumes_surgeles|legumes_conserve|champignons|brocoli"], ["oignon", "ail", "mais"], "jambon|poulet", "Riz cuit la veille si possible, sauté avec les légumes, œufs brouillés, sauce soja."),
    R("tofu_saute", "Tofu sauté aux légumes et riz", "🥢", 25, ["tofu", "riz", "brocoli|poivron|carotte|legumes_surgeles|champignons|courgette|chou"], ["ail", "oignon"], "poulet", "Tofu en dés doré à la poêle, légumes croquants, sauce soja, sur le riz."),
    R("crepes_salees", "Crêpes salées", "🥞", 40, ["farine", "oeufs", "lait|lait_vegetal"], ["fromage_rape", "champignons", "epinards", "salade"], "jambon", "Pâte à crêpes, garnir de fromage et légumes poêlés, plier et dorer."),
    R("gratin_dauph", "Gratin de pommes de terre", "🥔", 60, ["pomme_de_terre", "creme|lait|creme_vegetale", "fromage_rape"], ["ail", "salade", "oignon"], "jambon|saucisse", "Rondelles fines, crème, ail, fromage, 50 min à 180 °C. Avec une salade."),
    R("parmentier", "Parmentier de lentilles", "🥧", 50, ["pomme_de_terre", "lentilles", "carotte", "oignon"], ["fromage_rape", "tomates_concassees"], "viande_hachee", "Lentilles mijotées avec carotte et oignon, purée dessus, gratiner 20 min."),
    R("wraps", "Wraps aux légumes et haricots", "🌯", 20, ["tortillas", "poivron|salade|tomate|avocat", "haricots_rouges|steak_vegetal|tofu|pois_chiches"], ["fromage_rape", "mais", "oignon", "avocat"], "poulet", "Garnir les galettes, rouler, dorer 2 min à la poêle."),
    R("salade_compo", "Grande salade composée", "🥗", 15, ["salade", "tomate|concombre|carotte|betterave|mais", "oeufs|feta|fromage|pois_chiches"], ["pain", "avocat", "radis"], "thon|jambon|poulet", "Tout couper, vinaigrette moutarde, œufs durs ou fromage."),
    R("taboule", "Taboulé maison", "🥙", 20, ["semoule", "tomate", "concombre"], ["citron", "herbes", "oignon", "feta", "pois_chiches"], "poulet", "Semoule réhydratée, légumes en dés, citron, huile d'olive, herbes. Frais."),
    R("salade_lentilles", "Salade de lentilles ou de quinoa", "🫘", 25, ["lentilles|quinoa", "carotte|tomate|concombre|betterave|radis", "oignon|herbes"], ["feta", "oeufs", "fromage_frais"], "saumon_fume|lardons", "Lentilles ou quinoa cuits et refroidis, crudités, vinaigrette."),
    R("shakshuka", "Shakshuka (œufs à la tomate)", "🍳", 25, ["oeufs", "tomates_concassees|tomate", "poivron|oignon"], ["pain", "feta", "herbes"], "saucisse", "Poivron et oignon, tomate épicée, casser les œufs dessus, couvrir 8 min."),
    R("croques", "Croque-monsieur et salade", "🥪", 20, ["pain_de_mie|pain", "fromage|fromage_rape"], ["salade", "tomate", "beurre"], "jambon", "Pain, fromage (et tomate pour la version végé), au four ou à la poêle. Avec une salade."),
    R("burgers_vege", "Burgers végé", "🍔", 20, ["steak_vegetal", "pain|pain_de_mie", "salade|tomate"], ["fromage", "oignon", "frites"], "viande_hachee", "Galettes végé poêlées, pain grillé, crudités et fromage."),
    R("poelee_oeufs", "Poêlée de légumes et œufs au plat", "🍳", 25, ["courgette|poivron|champignons|haricots_verts|epinards|legumes_surgeles", "oeufs"], ["pomme_de_terre", "oignon", "pain"], "lardons|saucisse", "Légumes sautés (et pommes de terre), œufs au plat posés dessus."),
    R("couscous_leg", "Couscous de légumes", "🍲", 45, ["semoule", "pois_chiches", "carotte", "courgette"], ["oignon", "tomates_concassees", "courge"], "saucisse|poulet", "Légumes et pois chiches mijotés 30 min avec épices à couscous, semoule à côté."),
    R("gratin_choufleur", "Gratin de chou-fleur", "🥦", 45, ["chou_fleur", "lait|creme", "fromage_rape"], ["farine", "pomme_de_terre"], "jambon", "Chou-fleur précuit, béchamel ou crème, fromage, 25 min au four."),
    R("patates_douces_roties", "Patates douces rôties et pois chiches", "🍠", 40, ["patate_douce", "pois_chiches"], ["oignon", "fromage_frais", "salade", "feta"], "poulet", "Cubes de patate douce et pois chiches épicés, 30 min au four à 200 °C."),
    R("chou_poele", "Chou poêlé aux pommes de terre", "🥬", 35, ["chou", "pomme_de_terre", "oignon"], ["fromage_rape"], "saucisse|lardons", "Chou émincé et pommes de terre en dés, revenus longtemps à la poêle."),
    R("pdt_fromage", "Pommes de terre au four et fromage", "🧀", 45, ["pomme_de_terre", "fromage"], ["salade", "fromage_frais"], "jambon", "Pommes de terre au four, fromage fondu dessus, comme une raclette facile."),
    R("soupe_lentilles", "Soupe de lentilles", "🥣", 40, ["lentilles", "carotte", "oignon"], ["tomates_concassees", "pain", "citron"], "lardons", "Lentilles, carotte et oignon dans l'eau ou le bouillon 30 min, mixer à moitié."),
    R("ratatouille", "Ratatouille et semoule", "🍆", 50, ["courgette", "aubergine", "poivron|tomate|tomates_concassees", "semoule|riz"], ["oignon", "ail", "herbes"], "saucisse|poulet", "Légumes en dés mijotés 35 min à l'huile d'olive. Avec semoule ou riz."),
    R("riz_leg_surgeles", "Riz aux légumes surgelés et œuf", "🍚", 20, ["riz", "legumes_surgeles", "oeufs"], ["fromage_rape"], "jambon", "Riz, légumes surgelés à la poêle, un œuf mollet ou au plat dessus."),
    R("tartines_chevre", "Tartines chèvre-miel et salade", "🍯", 15, ["pain", "fromage_frais", "salade"], ["miel", "pomme"], "jambon", "Tartines de chèvre au four 8 min, un filet de miel, avec la salade."),
    R("haricots_verts_pdt", "Haricots verts et pommes de terre sautées", "🫛", 30, ["haricots_verts", "pomme_de_terre"], ["oignon", "ail", "oeufs"], "poulet|saucisse", "Haricots vapeur, pommes de terre sautées, ail et persil."),
    R("soupe_prete", "Soupe toute prête et tartines", "🍲", 10, ["soupe", "pain|pain_de_mie"], ["fromage", "fromage_frais"], "jambon", "Le dîner minute : soupe chauffée, tartines grillées au fromage."),
  ];
  const RECIPE_BY_ID = {};
  RECIPES.forEach(r => { RECIPE_BY_ID[r.id] = r; });

  function slotKeys(slot) { return slot.split("|").filter(k => TYPES[k]); }
  function slotLabel(slot) {
    const ks = slotKeys(slot);
    if (ks.length === 1) return TYPES[ks[0]].n;
    if (ks.length <= 3) return ks.map(k => TYPES[k].n).join(" ou ");
    return ks.slice(0, 2).map(k => TYPES[k].n).join(", ") + "…";
  }
  function recipeVeg(r) {
    // vegan si aucun ingrédient obligatoire n'est d'origine animale et qu'il existe un choix végétal pour chaque emplacement
    let vegan = true;
    for (const s of r.ing) { if (slotKeys(s).every(k => TYPES[k].animal)) vegan = false; }
    return vegan ? "vegan" : "vege";
  }
  // Ingrédients consommés par la recette (frais et congelés) : un produit ne sert qu'à un dîner.
  // Les produits de placard (paquet de pâtes, conserve…) servent plusieurs fois.
  function isConsumable(it) { const T = TYPES[it.t] || TYPES.autre; return T.fresh || it.place === "frigo"; }
  // Nombre de dîners qu'un produit peut servir (un filet d'oignons, une boîte d'œufs : plusieurs)
  function servings(it) { const T = TYPES[it.t] || TYPES.autre; return !isConsumable(it) ? Infinity : T.multi ? 3 : 1; }
  function useOf(used, it) { return used.get ? (used.get(it.id) || 0) : (used.has(it.id) ? Infinity : 0); }

  // ---------- Planning des dîners ----------
  // state.plan : { "YYYY-MM-DD": { r, locked, done } }
  function planDinners(state, ref, days) {
    days = days || 14;
    const s = state.settings || {};
    const fraisDays = s.fraisDays || 4;
    const plan = state.plan || {};
    const used = new Map(); // id -> nombre de dîners qui l'utilisent déjà
    const out = [];
    const recent = []; // recettes déjà placées
    const skip = state.skip || {}; // { date: [recipeIds écartés] }
    // ordre de traitement : jours verrouillés d'abord pour réserver leurs produits
    const dates = [];
    for (let i = 0; i < days; i++) dates.push(addDays(ref, i));
    const result = {};
    const pick = (date, r) => {
      const res = matchRecipe(r, state.items, date, used);
      res.uses.forEach(it => { if (isConsumable(it)) used.set(it.id, (used.get(it.id) || 0) + 1); });
      result[date] = { date, r: r.id, recipe: r, locked: !!(plan[date] && plan[date].locked), done: !!(plan[date] && plan[date].done), missing: res.missing, uses: res.uses, score: res.score };
      recent.push({ date, id: r.id });
    };
    // dans l'ordre des jours : les premiers soirs se servent en premier dans le stock
    dates.forEach((date, i) => {
      const p = plan[date];
      if (p && (p.locked || p.done) && RECIPE_BY_ID[p.r]) { pick(date, RECIPE_BY_ID[p.r]); return; }
      let best = null, bestScore = -Infinity;
      for (const r of RECIPES) {
        if ((skip[date] || []).includes(r.id)) continue;
        const m = matchRecipe(r, state.items, date, used);
        let score = m.score;
        // pénalités : ingrédients manquants
        m.missing.forEach(slot => {
          const fresh = slotKeys(slot).some(k => TYPES[k].fresh);
          score -= i === 0 ? 30 : fresh ? (i < fraisDays ? 14 : 4) : 9;
        });
        // variété
        recent.forEach(x => {
          if (x.id === r.id) { const gap = Math.abs(diffDays(x.date, date)); score -= gap < 7 ? 200 : 80; }
        });
        const prev = result[addDays(date, -1)], next = result[addDays(date, 1)];
        const base = mainStarch(r);
        if (base && ((prev && mainStarch(prev.recipe) === base) || (next && mainStarch(next.recipe) === base))) score -= 6;
        // plus rapide en semaine
        const wd = parse(date).getDay();
        if (wd >= 1 && wd <= 5 && r.min > 45) score -= 3;
        if (score > bestScore) { bestScore = score; best = r; }
      }
      if (best) pick(date, best);
    });
    dates.forEach(d => out.push(result[d]));
    return out;
  }
  function mainStarch(r) {
    const s = r.ing.find(x => /pates|riz|semoule|pomme_de_terre|pain|pate_tarte|tortillas|lentilles/.test(x));
    return s ? s.split("|")[0] : "";
  }
  // Pour un dîner à la date `date` : quels produits du stock remplissent les emplacements, lesquels manquent
  function matchRecipe(r, items, date, used) {
    used = used || new Map();
    const uses = [], missing = [];
    let score = 0;
    const take = (slot, required) => {
      const ks = slotKeys(slot);
      let best = null, bestN = Infinity;
      for (const it of items) {
        if (!ks.includes(it.t) || useOf(used, it) >= servings(it) || uses.includes(it)) continue;
        const n = diffDays(date, it.exp); // jours restants ce jour-là
        if (n < 0) continue; // sera périmé
        if (n < bestN) { best = it; bestN = n; }
      }
      if (best) {
        uses.push(best);
        score += required ? 10 : 3;
        const n0 = bestN;
        if (isConsumable(best)) score += Math.max(0, 9 - n0) * 1.5; // urgence : finir ce qui périme
      } else if (required) missing.push(slot);
    };
    r.ing.forEach(s => take(s, true));
    r.opt.forEach(s => take(s, false));
    // la viande ou le poisson du stock, cuit à part pour ceux qui en mangent
    if (r.prot) { const before = uses.length; take(r.prot, false); if (uses.length > before) score -= 2; }
    return { uses, missing, score };
  }

  // ---------- Listes de courses ----------
  const DEFAULT_BASES = ["pates", "riz", "oeufs", "lait", "beurre", "huile", "farine", "sucre", "oignon", "ail", "tomates_concassees", "cafe", "pain"];

  function shoppingLists(state, ref, plan) {
    const s = state.settings || {};
    const fraisDays = s.fraisDays || 4;
    const frais = {}, livraison = {};
    const add = (bag, key, label, why) => {
      if (!bag[key]) bag[key] = { key, label, why: [] };
      if (why && !bag[key].why.includes(why)) bag[key].why.push(why);
    };
    // produits de base absents ou presque finis
    (s.bases || DEFAULT_BASES).forEach(k => {
      const T = TYPES[k]; if (!T) return;
      const have = state.items.filter(it => it.t === k && diffDays(ref, it.exp) >= 0);
      const ok = have.some(it => !it.low);
      if (!ok) add(T.fresh ? frais : livraison, k, T.n, have.length ? "bientôt fini" : "produit de base");
    });
    // ingrédients manquants des dîners prévus
    (plan || []).forEach((p, i) => {
      if (!p || p.done) return;
      p.missing.forEach(slot => {
        const ks = slotKeys(slot);
        const fresh = ks.some(k => TYPES[k].fresh);
        const why = p.recipe.n + " (" + dayLabel(p.date, ref).toLowerCase() + ")";
        const bag = fresh ? frais : livraison;
        if (fresh && i >= fraisDays) return;
        const already = ks.find(k => bag[k]); // déjà sur la liste comme produit de base
        add(bag, already || slot, already ? TYPES[already].n : slotLabel(slot), why);
      });
    });
    // un emplacement déjà couvert par une base identique : on garde une seule ligne
    const toArr = bag => Object.values(bag).sort((a, b) => a.label.localeCompare(b.label, "fr"));
    return { frais: toArr(frais), livraison: toArr(livraison) };
  }

  // ---------- État ----------
  function emptyState() {
    return { v: 1, items: [], codes: {}, plan: {}, skip: {}, history: [],
      lists: { frais: { manual: [], chk: {} }, livraison: { manual: [], chk: {} } },
      settings: { bases: DEFAULT_BASES.slice(), fraisDays: 4, nextDelivery: "" } };
  }
  function migrate(s) {
    const e = emptyState();
    if (!s || typeof s !== "object") return e;
    for (const k of Object.keys(e)) if (s[k] == null) s[k] = e[k];
    s.settings = Object.assign({}, e.settings, s.settings);
    s.lists = Object.assign({}, e.lists, s.lists);
    ["frais", "livraison"].forEach(k => { s.lists[k] = Object.assign({ manual: [], chk: {} }, s.lists[k]); });
    return s;
  }
  // Nettoie le planning et les « autres idées » des jours passés
  function prunePast(state, ref) {
    for (const d of Object.keys(state.plan)) if (d < ref) delete state.plan[d];
    for (const d of Object.keys(state.skip)) if (d < ref) delete state.skip[d];
  }

  const Core = { TYPES, TYPE_LIST, GROUPS, PLACES, RECIPES, RECIPE_BY_ID, DEFAULT_BASES,
    iso, parse, today, addDays, diffDays, dayLabel, leftLabel,
    matchCategories, vegOf, productFromOFF, newItem, displayName, daysLeft, openItem, freezeItem, priority,
    slotKeys, slotLabel, recipeVeg, isConsumable, servings, planDinners, matchRecipe, shoppingLists,
    emptyState, migrate, prunePast, uid };
  if (typeof module !== "undefined" && module.exports) module.exports = Core; else root.Core = Core;
})(typeof window !== "undefined" ? window : globalThis);
