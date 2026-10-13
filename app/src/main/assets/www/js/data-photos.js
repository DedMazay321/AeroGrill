'use strict';
// Фото с Wikimedia Commons: a — автор, l — лицензия, u — страница файла. Файл создаёт tools/photos.py build
const PHOTOS = {
 "wings": {
  "a": "Vee Satayamas",
  "l": "CC BY 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Bankrueed_fried_chicken_wings.jpg"
 },
 "wings-honey": {
  "a": "jeffreyw",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Honey_chicken_wings_(6630284309).jpg"
 },
 "breast-steam": {
  "a": "Daderot",
  "l": "CC0",
  "u": "https://commons.wikimedia.org/wiki/File:Chicken_breast_with_paprika_and_other_spices,_sauteed_broccoli,_and_sauteed,_sliced_potato_-_Massachusetts.jpg"
 },
 "thighs": {
  "a": "Willis Lam",
  "l": "CC BY-SA 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Roast_Chicken_Legs_and_Thighs_(31196736704).jpg"
 },
 "drumsticks": {
  "a": "Baoothersks",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Roasted_chicken_and_Cooked_rice.jpg"
 },
 "nuggets": {
  "a": "Mx. Granger",
  "l": "CC0",
  "u": "https://commons.wikimedia.org/wiki/File:Impossible_chicken_nuggets_2.jpg"
 },
 "turkey-cutlets": {
  "a": "Silar",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:020230716_Frikadelle_mit_Gem%C3%BCse_und_Kartoffeln.jpg"
 },
 "chicken-kebab": {
  "a": "Chloe Lim from Seoul, South Korea",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Korean_spicy_chicken_skewers_(6325410086).jpg"
 },
 "pork-kebab": {
  "a": "Limited fantasy",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Shashlik_made_of_pork.jpg"
 },
 "ribs": {
  "a": "Pannet",
  "l": "CC BY 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Pork-ribs_02.jpg"
 },
 "steak": {
  "a": "Jon Sullivan",
  "l": "Public domain",
  "u": "https://commons.wikimedia.org/wiki/File:Ribeyes.jpeg"
 },
 "pork-steak": {
  "a": "Ceeseven",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Grilled_Pork_Chop_with_Rice.jpg"
 },
 "burger": {
  "a": "Ralff Nestor Nacor",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Homemade_Hamburger,_May_2024.jpg"
 },
 "salmon": {
  "a": "Andy / Andrew Fogg from near Cambridge, UK",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Time_for_another_food_picture_-)_(4200042228).jpg"
 },
 "cod-panko": {
  "a": "Benreis",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Hecht_paniert_K%C3%B6nig_von_Flandern.jpg"
 },
 "mackerel": {
  "a": "Kernow Skies",
  "l": "CC BY-SA 3.0",
  "u": "https://commons.wikimedia.org/wiki/File:Grilled_mackerel_on_a_BBQ.jpg"
 },
 "shrimp-garlic": {
  "a": "Banej",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Gambas_Al_Ajillo_(Spanish_Garlic_Shrimp).jpg"
 },
 "shrimp-panko": {
  "a": "Ocdp",
  "l": "CC0",
  "u": "https://commons.wikimedia.org/wiki/File:Ebi_Fry_002.jpg"
 },
 "tofu": {
  "a": "Supardisahabu",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Tahu_Goreng.jpg"
 },
 "fries": {
  "a": "Tony Webster from Minneapolis, Minnesota, United States",
  "l": "CC BY-SA 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Truffle_oil_french_fries_(33024792848).jpg"
 },
 "potato-wedges": {
  "a": "Luca Hammer from Paderborn, Germany",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Potato_wedges_at_Mensa_Paderborn_(11956794164).jpg"
 },
 "fries-frozen": {
  "a": "bob walker from London, UK",
  "l": "CC BY-SA 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:French_fries_(48855760853).jpg"
 },
 "sweet-potato": {
  "a": "Thriving Vegetarian",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Baked_Sweet_Potato_Fries_With_Rosemary_and_Parmesan_-_8420845814.jpg"
 },
 "veg-grill": {
  "a": "Karen and Brad Emerson",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Grilled_vegetables_(6373328369).jpg"
 },
 "broccoli-steam": {
  "a": "Acabashi",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Sunday_roast_vegetable_side_dish_at_The_Stag,_Little_Easton,_Essex,_England.jpg"
 },
 "mushrooms": {
  "a": "Stacy",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Stuffed_portabella_mushrooms,_June_2009.jpg"
 },
 "stuffed-peppers": {
  "a": "Mark Bonica",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Quinoa_stuffed_peppers.jpg"
 },
 "chickpeas": {
  "a": "Physicistjedi",
  "l": "Public domain",
  "u": "https://commons.wikimedia.org/wiki/File:Leblebi.jpg"
 },
 "pizza": {
  "a": "Mario56",
  "l": "CC BY-SA 3.0",
  "u": "https://commons.wikimedia.org/wiki/File:Margherita_Originale.JPG"
 },
 "pizza-tortilla": {
  "a": "jeffreyw",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Tortilla_pizza.jpg"
 },
 "quesadilla": {
  "a": "Daderot",
  "l": "CC0",
  "u": "https://commons.wikimedia.org/wiki/File:Chicken_quesadilla_-_Massachusetts.jpg"
 },
 "egg-toast": {
  "a": "Jonathunder",
  "l": "CC BY-SA 3.0",
  "u": "https://commons.wikimedia.org/wiki/File:EggToast.jpg"
 },
 "syrniki": {
  "a": "Tatyana Morozyuk, color processing by Off-shell",
  "l": "CC BY-SA 3.0",
  "u": "https://commons.wikimedia.org/wiki/File:Syrniki6.jpg"
 },
 "casserole": {
  "a": "Berser25",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:%D0%97%D0%B0%D0%BF%D1%96%D0%BA%D0%B0%D0%BD%D0%BA%D0%B0_%D1%81%D0%B8%D1%80%D0%BD%D0%B0_%D0%B7_%D1%80%D0%BE%D0%B4%D0%B7%D0%B8%D0%BD%D0%BA%D0%B0%D0%BC%D0%B8_02.jpg"
 },
 "frittata": {
  "a": "Andy Li",
  "l": "CC0",
  "u": "https://commons.wikimedia.org/wiki/File:Frittata_-_Bam%27s_Kitchen_2024-04-02.jpg"
 },
 "muffins": {
  "a": "Bycro",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Muffins_02.jpg"
 },
 "cake": {
  "a": "Wildhoney",
  "l": "CC BY-SA 3.0",
  "u": "https://commons.wikimedia.org/wiki/File:Pound_cake_(with_raisin).JPG"
 },
 "baked-apples": {
  "a": "Alabama Extension",
  "l": "CC0",
  "u": "https://commons.wikimedia.org/wiki/File:Hot_and_Sweet_Baked_Apples_-_50495578482.jpg"
 },
 "oat-cookies": {
  "a": "Paul Martin",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Oatmeal_Cookies_with_orange_zest,_golden_raisins,_and_chocolate_chips.jpg"
 },
 "granola": {
  "a": "No machine-readable author provided. Miskatonic assumed (based on copyright clai",
  "l": "CC BY 2.5",
  "u": "https://commons.wikimedia.org/wiki/File:Granola03242006.JPG"
 },
 "apple-chips": {
  "a": "Fumikas Sagisavas",
  "l": "CC0",
  "u": "https://commons.wikimedia.org/wiki/File:Zhejiang_Jiaxing_freeze-dried_apple_chips.jpg"
 },
 "banana-chips": {
  "a": "Fumikas Sagisavas",
  "l": "CC0",
  "u": "https://commons.wikimedia.org/wiki/File:Dried_banana_chips.jpg"
 },
 "jerky": {
  "a": "Larry Jacobsen from Cheyenne Wyoming",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Jerky_(1).jpg"
 },
 "chicken-whole": {
  "a": "Jameswasswa",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Whole_spiced_chicken_(roasted).jpg"
 },
 "legs-bbq": {
  "a": "Diana from Pennsylvania USA",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Barbecued_chicken_drumsticks-02.jpg"
 },
 "chicken-schnitzel": {
  "a": "Andy Li",
  "l": "CC0",
  "u": "https://commons.wikimedia.org/wiki/File:Classic_chicken_schnitzel_-_Schnitzel_%26_Co._2026-05-16.jpg"
 },
 "chicken-rolls": {
  "a": "Ann Larie Valentine from San Francisco, CA, USA",
  "l": "CC BY-SA 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Very_sad_chicken_roulades_(3240853633).jpg"
 },
 "chicken-teriyaki": {
  "a": "Flickr.com user \"Blue Lotus\"",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Chicken_teriyaki.jpg"
 },
 "chicken-hearts": {
  "a": "대경라이프",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Yeomtong-kkochi_and_yangnyeom-dwaeji-galbi.jpg"
 },
 "chicken-liver": {
  "a": "Joe Foodie",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Chicken_Livers.jpg"
 },
 "turkey-steak": {
  "a": "Missvain",
  "l": "CC BY 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Cooked_turkey_breast_-_November_2023_-_Sarah_Stierch.jpg"
 },
 "turkey-meatballs": {
  "a": "Tiia Monto",
  "l": "CC BY-SA 3.0",
  "u": "https://commons.wikimedia.org/wiki/File:Baked_meatballs.jpg"
 },
 "chicken-strips": {
  "a": "FotoosVanRobin from Netherlands",
  "l": "CC BY-SA 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Crispy_Chicken_Strips_-_FotoosVanRobin.jpg"
 },
 "wings-buffalo": {
  "a": "stef yau",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Homemade_buffalo_wings.jpg"
 },
 "chicken-tandoori": {
  "a": "Miansari66",
  "l": "CC0",
  "u": "https://commons.wikimedia.org/wiki/File:Tandoori_Chicken_1.JPG"
 },
 "duck-breast": {
  "a": "Alpha from Melbourne, Australia",
  "l": "CC BY-SA 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Grilled_eel.jpg"
 },
 "chicken-lula": {
  "a": "Lesya Dolyk",
  "l": "CC BY-SA 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Lula_kebab_2.jpg"
 },
 "chicken-potato": {
  "a": "P1898",
  "l": "CC BY 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Roasted_potatoes_chicken.jpg"
 },
 "pork-tenderloin": {
  "a": "Taylorderek",
  "l": "CC BY 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Pork_Tenderloin_on_cutting_board.jpg"
 },
 "buzhenina": {
  "a": "Rainer Zenz",
  "l": "CC BY-SA 3.0",
  "u": "https://commons.wikimedia.org/wiki/File:Schweinsbraten-1.jpg"
 },
 "pork-schnitzel": {
  "a": "Burkhard Mücke",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:2022-12-29_Wiener_Schnitzel_im_Hotel_Kaiserin_Elisabeth.jpg"
 },
 "lamb-lula": {
  "a": "Lesya Dolyk",
  "l": "CC BY-SA 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Lula_kebab.jpg"
 },
 "meatballs-tomato": {
  "a": "jeffreyw",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Spaghetti_and_meatballs_1.jpg"
 },
 "cutlets": {
  "a": "Jacek Halicki",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:2023_Kotlety_mielone.jpg"
 },
 "bacon": {
  "a": "Missvain",
  "l": "CC BY 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:2018_Corner_117_Bacon_Dinner_-_Sarah_Stierch.jpg"
 },
 "kupaty": {
  "a": "AleWi",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Grilled_sausages,_Skansen,_20230226.jpg"
 },
 "roast-beef": {
  "a": "Acabashi",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Roast_topside_of_beef.jpg"
 },
 "lamb-rack": {
  "a": "Acabashi",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Rack_of_lamb_cutlets_dinner_at_Black_Horse_Inn,_West_Sussex,_England.jpg"
 },
 "meatloaf": {
  "a": "Renee Comet (photographer)",
  "l": "Public domain",
  "u": "https://commons.wikimedia.org/wiki/File:MeatloafWithSauce.jpg"
 },
 "pork-french": {
  "a": "Hayford Peirce @ Citizendum",
  "l": "CC BY-SA 3.0",
  "u": "https://commons.wikimedia.org/wiki/File:Veal_Orloff_4.jpg"
 },
 "fajitas": {
  "a": "Eric T Gunther",
  "l": "CC BY-SA 3.0",
  "u": "https://commons.wikimedia.org/wiki/File:Beef_Fajitas_Costa_Rica.JPG"
 },
 "sausage-rolls": {
  "a": "Andy Li",
  "l": "CC0",
  "u": "https://commons.wikimedia.org/wiki/File:Bacon_%26_maple_sausage_roll_-_Bread_%26_Milk,_Brighton_2024-12-24.jpg"
 },
 "trout-whole": {
  "a": "Bdx",
  "l": "CC0",
  "u": "https://commons.wikimedia.org/wiki/File:Grilled_trout,_Restaurant_Trofta,_Istog,_2025.jpg"
 },
 "pollock-lemon": {
  "a": "Benreis",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Brachsenfilet_Katoffelsalat_Sonne_Bischberg.jpg"
 },
 "fish-cakes": {
  "a": "phototram",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Fishcake_on_salad.jpg"
 },
 "tuna-steak": {
  "a": "eric molina from San Francisco, United States",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Seared_Ahi_Tuna_Steak.jpg"
 },
 "salmon-teriyaki": {
  "a": "Prayitno / Thank you for (12 millions +) view from Los Angeles, USA",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Grilled_Teriyaki_Salmon_(10900376705).jpg"
 },
 "squid-rings": {
  "a": "Maksym Kozlenko",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Fried_Calamari_Rings.jpg"
 },
 "fish-sticks": {
  "a": "Superbass",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Fishfinger_classic_frozen_1.jpg"
 },
 "pink-salmon-cheese": {
  "a": "Sumit Surai",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Chili_Pickle_and_Cheese_Baked_Crab_with_Kolmi_greens.JPG"
 },
 "salmon-skewers": {
  "a": "Famartin",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:2020-03-09_21_11_13_Salmon_kabobs_from_Zo%C3%ABs_Kitchen_in_the_Franklin_Farm_section_of_Oak_Hill,_Fairfax_County,_Virginia.jpg"
 },
 "tilapia": {
  "a": "Ganesh Dhamodkar",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Fried_Tilapia_Fish.jpg"
 },
 "shrimp-bacon": {
  "a": "Revelpatiogrill",
  "l": "CC0",
  "u": "https://commons.wikimedia.org/wiki/File:Bacon_Wrapped_Shrimp_Skewers_at_The_Revel_Patio_Grill.jpg"
 },
 "corn": {
  "a": "TAPAS KUMAR HALDER",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Indian_Roasted_Corn_on_the_Cob-_Kolkata_-_West_Bengal_-_DSC_0007.jpg"
 },
 "carrots-honey": {
  "a": "Karen and Brad Emerson",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Ginger_glazed_carrots_2010.jpg"
 },
 "zucchini-sticks": {
  "a": "Chris Olszewski",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Fried_Zucchini_dish.jpg"
 },
 "eggplant-boats": {
  "a": "Gordon Joly from London, UK",
  "l": "CC BY-SA 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Stuffed_eggplant_supreme_with_panir_cheese_and_chickpeas_(2180891335).jpg"
 },
 "cauliflower-spicy": {
  "a": "Wheeler Cowperthwaite",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Plated_roasted_cauliflower_10.jpg"
 },
 "brussels-bacon": {
  "a": "Kelly Sue",
  "l": "CC BY-SA 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Roasted_Brussels_Sprouts_with_Kumquats.jpg"
 },
 "green-beans": {
  "a": "FASTILY",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Sauteed_Garlic_Green_Beans_1_2017-02-22.jpg"
 },
 "pumpkin-honey": {
  "a": "Polonist",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Roasted_Pumpkin,_Onion_and_Garlic.jpg"
 },
 "jacket-potato": {
  "a": "Renee Comet (photographer)",
  "l": "Public domain",
  "u": "https://commons.wikimedia.org/wiki/File:BakedPotatoWithButter.jpg"
 },
 "hasselback": {
  "a": "Aurus Sy",
  "l": "CC0",
  "u": "https://commons.wikimedia.org/wiki/File:Hasselback_Potatoes.jpg"
 },
 "draniki": {
  "a": "Photo made by Daniel Spils and uploaded to flickr.com",
  "l": "CC BY-SA 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Potato_pancakes.jpg"
 },
 "onion-rings": {
  "a": "Jess Sawrey from Los Angeles, California, USA",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Flickr_pancakejess_677476794--Onion_rings.jpg"
 },
 "mushrooms-garlic": {
  "a": "Lalithya Dwivedula",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Thyme_roasted_mushrooms.jpg"
 },
 "tomato-mozzarella": {
  "a": "Homemade-Flavours",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Baked_Parmesan_Tomatoes04.jpg"
 },
 "falafel": {
  "a": "Burkhard Mücke",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Falafel_beim_Isarinselfest_M%C3%BCnchen_2.jpg"
 },
 "peppers-roasted": {
  "a": "Ryan Snyder",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Roasted_Bell_Peppers_(3138711870).jpg"
 },
 "zucchini-fritters": {
  "a": "Nicole Bratt from Seattle, WA, USA",
  "l": "CC BY-SA 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Zucchini_%26_feta_fritters_(7804257920).jpg"
 },
 "ratatouille": {
  "a": "Marcus Guimarães",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Ratatouille.jpg"
 },
 "potato-chips": {
  "a": "Ann from USA",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Homemade_Potato_Chips_(11115638044).jpg"
 },
 "mozzarella-sticks": {
  "a": "Alvis at English Wikibooks",
  "l": "Public domain",
  "u": "https://commons.wikimedia.org/wiki/File:Mozzarella_394.jpg"
 },
 "pizza-pepperoni": {
  "a": "Dale Cruse from San Francisco, CA, USA",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:All_Good_pizza_(38501728345).jpg"
 },
 "pizza-ham-mushroom": {
  "a": "Gerda Arendt",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Pizza_capricciosa,_Munich.jpg"
 },
 "croque": {
  "a": "Visitor7",
  "l": "CC BY-SA 3.0",
  "u": "https://commons.wikimedia.org/wiki/File:Nue_Croque_Monsieur.jpg"
 },
 "burrito": {
  "a": "samuelfernandezrivera",
  "l": "CC0",
  "u": "https://commons.wikimedia.org/wiki/File:Burrito.JPG"
 },
 "samsa": {
  "a": "N509FZ",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Samsa_at_G%C3%BClhan_Restaurant,_Beijing_(20210402171539).jpg"
 },
 "cheese-puffs": {
  "a": "Kolforn (Kolforn) I'd appreciate if you could mail me (Kolforn@gmail.com) if you",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:-2019-12-23_Brie_cheese_puff_pastry_pocket,_Trimingham.JPG"
 },
 "lavash-cheese": {
  "a": "Maderibeyza",
  "l": "CC BY-SA 3.0",
  "u": "https://commons.wikimedia.org/wiki/File:G%C3%B6zleme.JPG"
 },
 "hot-dog": {
  "a": "stu_spivack",
  "l": "CC BY-SA 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Hot_dog_01.jpg"
 },
 "calzone": {
  "a": "Mario56",
  "l": "CC BY-SA 3.0",
  "u": "https://commons.wikimedia.org/wiki/File:Calzone_Tradition_%2B_poivrons.JPG"
 },
 "bruschetta": {
  "a": "Missvain",
  "l": "CC BY 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Bruschetta_at_The_Bar_at_MacArthur_Place_-_Sarah_Stierch.jpg"
 },
 "julienne": {
  "a": "PattayaPatrol",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:DZ3_0965_Comfort_food_night_in_Pattaya_cheesy_baked_mash_creamy_chicken_stew_and_crispy_fries_on_a_cozy_table.jpg"
 },
 "khachapuri": {
  "a": "Eugene Krasnaok",
  "l": "CC BY 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Khachapuri_Adjaruli_with_egg_and_butter_2016.jpg"
 },
 "garlic-bread": {
  "a": "Andy Li",
  "l": "CC0",
  "u": "https://commons.wikimedia.org/wiki/File:Garlic_Bread_Mozzarella_-_Oregano_Pizzeria_2025-05-17.jpg"
 },
 "boiled-eggs": {
  "a": "Ramesh NG",
  "l": "CC BY-SA 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Boiled_Egg_-_Crossection.jpg"
 },
 "egg-avocado": {
  "a": "Gordana Adzieva",
  "l": "CC BY 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:%D0%9F%D0%B5%D1%87%D0%B5%D0%BD%D0%BE_%D0%B0%D0%B2%D0%BE%D0%BA%D0%B0%D0%B4%D0%BE_%D1%81%D0%BE_%D1%98%D0%B0%D1%98%D1%86%D0%B5.jpg"
 },
 "baked-oats": {
  "a": "Ella Olsson from Stockholm, Sweden",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Banana_Oatmeal_Breakfast_Bowl_(44302857265).jpg"
 },
 "french-toast": {
  "a": "Ocdp",
  "l": "CC0",
  "u": "https://commons.wikimedia.org/wiki/File:French_toast_001.jpg"
 },
 "cocotte": {
  "a": "Jpbrigand2",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Oeuf_cocotte.jpg"
 },
 "cottage-muffins": {
  "a": "NordWood Themes nordwood",
  "l": "CC0",
  "u": "https://commons.wikimedia.org/wiki/File:Homemade_Muffins_(Unsplash).jpg"
 },
 "omelette": {
  "a": "John Freeman",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Ham_%26_Cheddar_Omelet_(1)_(38273841901).jpg"
 },
 "granola-bars": {
  "a": "LironOmri12",
  "l": "CC0",
  "u": "https://commons.wikimedia.org/wiki/File:Granola_bars.jpg"
 },
 "charlotte": {
  "a": "Andy Li",
  "l": "CC0",
  "u": "https://commons.wikimedia.org/wiki/File:Apple_%26_Apricot_Charlotte_-_Sugardough_2025-07-01.jpg"
 },
 "brownie": {
  "a": "Wikimedia Commons",
  "l": "CC BY-SA 3.0",
  "u": "https://commons.wikimedia.org/wiki/File:Chocolate_brownies_without_table.jpg"
 },
 "cheesecake": {
  "a": "Sirabellas",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Raised_slice_of_cheesecake.jpg"
 },
 "cookies": {
  "a": "Mshuang2",
  "l": "CC0",
  "u": "https://commons.wikimedia.org/wiki/File:Chocolate_chip_cookies_on_cutting_board.jpg"
 },
 "croissants": {
  "a": "Missvain",
  "l": "CC BY 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Le_Croissant_French_Bakery_-_November_2023_-_Sarah_Stierch_06.jpg"
 },
 "bananas-chocolate": {
  "a": "Kim Scarborough from Chicago, IL",
  "l": "CC BY-SA 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Grilled_banana_(1417674861).jpg"
 },
 "mannik": {
  "a": "Zserghei",
  "l": "CC BY-SA 3.0",
  "u": "https://commons.wikimedia.org/wiki/File:Semolina_cake.jpg"
 },
 "carrot-cake": {
  "a": "Andy Li",
  "l": "CC0",
  "u": "https://commons.wikimedia.org/wiki/File:Carrot_Cake_-_The_Den_2025-07-23.jpg"
 },
 "cinnamon-rolls": {
  "a": "Pannet",
  "l": "CC BY 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Homemade_Cinnamon_rolls_06.jpg"
 },
 "fondant": {
  "a": "FotoosVanRobin from Netherlands",
  "l": "CC BY-SA 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Chocolate_Fondant.jpg"
 },
 "honey-almonds": {
  "a": "Veganbaking.net from USA",
  "l": "CC BY-SA 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Vegan_Cherry_Candied_Almonds_(4106810857).jpg"
 },
 "meringue": {
  "a": "Marcin Floryan",
  "l": "CC BY 2.5",
  "u": "https://commons.wikimedia.org/wiki/File:Home_made_meringues.jpg"
 },
 "croutons": {
  "a": "Bi-frie (talk)",
  "l": "CC BY 3.0",
  "u": "https://commons.wikimedia.org/wiki/File:13-09-01-kochtreffen-wien-Bi-frie-004.jpg"
 },
 "lavash-chips": {
  "a": "BrokenSphere",
  "l": "CC BY-SA 3.0",
  "u": "https://commons.wikimedia.org/wiki/File:Tortilla_chips.JPG"
 },
 "baked-pears": {
  "a": "Мирослава Садовець",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:%D0%A1%D1%82%D0%B0%D1%80%D0%BE%D0%B2%D0%B8%D0%BD%D0%BD%D0%B8%D0%B9_%D0%BE%D1%81%D1%82%D1%80%D0%BE%D0%B7%D1%8C%D0%BA%D0%B8%D0%B9_%D0%B4%D0%B5%D1%81%D0%B5%D1%80%D1%82_01.jpg"
 },
 "dried-tomatoes": {
  "a": "Andrew Deacon",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Sun-dried_tomatoes.jpg"
 },
 "dried-mushrooms": {
  "a": "André Karwath aka Aka",
  "l": "CC BY-SA 2.5",
  "u": "https://commons.wikimedia.org/wiki/File:Dried_mushrooms.jpg"
 },
 "dried-greens": {
  "a": "E4024",
  "l": "CC BY-SA 4.0",
  "u": "https://commons.wikimedia.org/wiki/File:Fresh_dill,_washed.jpg"
 },
 "pastila": {
  "a": "Matthieu Deuté",
  "l": "CC BY-SA 3.0",
  "u": "https://commons.wikimedia.org/wiki/File:Cuirs_de_fruits_kiwi_banane_pomme_raisin_canneberge_pomme_kiwi_tomate.jpg"
 },
 "dried-pears": {
  "a": "Vicki Nunn",
  "l": "Public domain",
  "u": "https://commons.wikimedia.org/wiki/File:DriedPears.JPG"
 },
 "chicken-jerky": {
  "a": "_ Kripptic",
  "l": "CC BY 2.0",
  "u": "https://commons.wikimedia.org/wiki/File:Venison_jerky.jpg"
 },
 "strawberry-chips": {
  "a": "Fumikas Sagisavas",
  "l": "CC0",
  "u": "https://commons.wikimedia.org/wiki/File:Dried_Strawberries.jpg"
 }
};
