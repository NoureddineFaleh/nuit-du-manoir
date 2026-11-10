'use strict';
// Règles des jeux, en deux niveaux : « quick » (l'essentiel en quelques lignes) et « sections » (le détail avec exemples).
// Chaque langue : { title, intro, quick:[{t,d}], sections:[{h, p?, list?, ex?}], faq:[{q,a}] }

const RULES = {
  // ===================================================================== MANOIR
  manoir: {
    fr: {
      title: 'La Nuit du Manoir',
      intro: 'Vous êtes 4 ou 5 invités dans un manoir hanté. Chacun joue sur son téléphone, l’écran raconte la nuit. Deux d’entre vous sont alliés en secret, mais ne se connaissent pas.',
      quick: [
        { t: 'Le but', d: 'Rester en vie. Les Solitaires jouent chacun pour soi ; les deux Liés (alliés secrets) gagnent ensemble.' },
        { t: 'Ta Raison', d: 'Chacun a 3 bougies de Raison. Chaque attaque en éteint une. À 0, tu deviens Hanté.' },
        { t: 'Une nuit, en 5 temps', d: 'Crépuscule (défi) → Minuit (attaque secrète) → Veillée (on discute) → Rituel (on vote) → Aube (le bilan).' },
        { t: 'Le Marqueur', d: 'Le gagnant du défi attaque en secret une personne à Minuit : −1 Raison pour elle.' },
        { t: 'Les objets', d: 'Lanterne, Couteau rouillé, Sel, Miroir : un seul par nuit, pour te protéger ou attaquer.' },
        { t: 'La victoire', d: 'Les Liés gagnent quand tous les Solitaires sont tombés. Sinon, le dernier Solitaire debout gagne.' },
      ],
      sections: [
        { h: 'Les rôles', p: 'Ton rôle est secret : seul ton téléphone le connaît. Il n’est révélé à personne avant la fin.', list: [
          'Solitaire : tu joues pour toi seul. Tu gagnes si tu es le dernier Solitaire debout.',
          'Lié : un autre invité est lié à toi, mais tu ne sais pas qui. Vous gagnez ensemble quand tous les Solitaires sont éliminés.' ],
          ex: 'À 5 joueurs : 2 Liés et 3 Solitaires. À 4 joueurs : 2 Liés et 2 Solitaires.' },
        { h: '1. Le Crépuscule : le défi', p: 'Tout le monde joue le même défi sur son téléphone. Il y en a quatre types :', list: [
          'Quiz glauque : 3 questions d’horreur. Le plus juste et le plus rapide l’emporte.',
          'Mémoire du noir : retenez la séquence de symboles qui clignote.',
          'Les yeux du manoir : touchez les yeux qui s’ouvrent, évitez les araignées.',
          'La vraie confession (bluff) : inventez une réponse crédible ; on devra retrouver la vraie parmi les inventions.' ],
          ex: 'Le podium classe tout le monde. Le 1er devient le Marqueur. Les deux premiers reçoivent un objet de la Chose (si leur inventaire n’est pas plein : 3 objets maximum).' },
        { h: '2. Minuit : les actions secrètes', list: [
          'Le Marqueur désigne une cible : elle perdra 1 Raison à l’aube.',
          'Chacun peut utiliser un objet, un seul par nuit (voir plus bas).',
          'Les Liés peuvent lancer un Murmure, une seule fois dans la partie : tu « chuchotes » à quelqu’un. S’il est Lié, vous recevez tous les deux un écho (« X est ton Lié »). Sinon, il entend une voix glaciale et toi aucun écho.',
          'À partir de l’acte II, le Pacte : tu reçois un objet tout de suite, mais tu perds 1 Raison à l’aube (il faut avoir au moins 2 Raison et de la place dans l’inventaire).' ],
          ex: 'Sara est Marqueur et vise Karim. Karim joue la Lanterne : sa perte de Raison est annulée. Personne ne sait qui a attaqué qui avant l’aube.' },
        { h: 'Les 4 objets', list: [
          '🕯️ Lanterne : annule la prochaine perte de Raison que tu subis cette nuit.',
          '🔪 Couteau rouillé : −1 Raison à une cible, en secret.',
          '🧂 Sel : toute attaque de la nuit contre toi est renvoyée à son auteur.',
          '🪞 Miroir : montre si la cible est Liée ou Solitaire. Attention : s’il ne te reste qu’1 Raison, il peut mentir.' ],
          ex: 'Sara attaque Karim, qui a joué le Sel. L’attaque revient sur Sara : sa Raison passe de 3 à 2.' },
        { h: 'La rune secrète', p: 'Chaque joueur voit une rune sur son téléphone. Dans la plupart des parties, les deux Liés voient la même : c’est leur indice pour se reconnaître sans parler. Certaines malédictions peuvent dévoiler une rune à tous.' },
        { h: '3. La Veillée : on discute', p: 'Un temps libre pour parler à voix haute : accuser, mentir, proposer une alliance. Pas de règle, sauf les événements ci-dessous.' },
        { h: 'Les événements de la Chose', p: 'À chaque aube, la Chose peut déclencher un événement pour la nuit suivante :', list: [
          'Coupure : l’écran reste noir un moment.',
          'Murmures : chacun reçoit une phrase privée, peut-être vraie, peut-être fausse.',
          'Brouillard (dès l’acte II) : au Rituel, personne ne saura qui a voté pour qui.',
          'Possession (dès l’acte II) : quelqu’un vote ce que la Chose lui ordonne.',
          'Silence (dès l’acte II) : plus un mot, seulement des gestes sur le téléphone.' ] },
        { h: '4. Le Rituel : le vote', p: 'Chacun vote pour la personne la plus suspecte. Le plus voté perd 1 Raison. En cas d’égalité, le sort tranche.', ex: 'À l’acte III, le Rituel est mortel : le plus voté meurt, et le Marqueur est protégé.' },
        { h: '5. L’Aube : le bilan', p: 'L’écran révèle, ligne par ligne, qui a perdu de la Raison et qui est tombé. Puis une nouvelle nuit commence.' },
        { h: 'Raison, Hantés et hallucinations', list: [
          'À 0 Raison, tu deviens Hanté : tu ne joues plus, mais chaque nuit les Hantés choisissent ensemble une malédiction parmi trois (étouffer un objet, raccourcir la veillée, dévoiler une rune, souffler une fausse voix, voter dans le noir).',
          'À 1 Raison, tu hallucines : ton téléphone se dérègle, tu peux recevoir de fausses voix, et le Miroir peut mentir.' ] },
        { h: 'Les trois actes', list: [
          'Acte I : l’Arrivée. Les 2 premières nuits, des événements simples.',
          'Acte II : la Descente. Tous les événements, et le Pacte.',
          'Acte III : le Dernier Cercle (quand il reste 3 joueurs ou moins). Le Rituel tue.',
          'À partir de la nuit 9, tout le monde perd 1 Raison à l’aube : la partie ne peut pas durer éternellement.' ] },
        { h: 'Comment on gagne', list: [
          'Les Liés gagnent si tous les Solitaires sont tombés.',
          'S’il ne reste aucun Lié, le dernier Solitaire debout gagne.',
          'Si tout le monde tombe, c’est la Chose qui gagne.' ] },
      ],
      faq: [
        { q: 'Peut-on dire son rôle ?', a: 'Oui, mais rien ne prouve que c’est vrai. Mentir fait partie du jeu.' },
        { q: 'Que fait un Hanté ?', a: 'Il regarde, ne parle plus, et participe à la malédiction collective de chaque nuit.' },
        { q: 'Un joueur se déconnecte ?', a: 'Il peut revenir avec la même adresse : sa place l’attend.' },
      ],
    },
    aeb: {
      title: 'ليلة القصر',
      intro: 'أنتم 4 ولا 5 ضيوف في قصر مسكون. كل واحد يلعب بتليفونو والشاشة تحكي الليل. زوز منكم متحالفين في السر، أما ما يعرفوش بعضهم.',
      quick: [
        { t: 'الهدف', d: 'تبقى عايش. المنفردين كل واحد لروحو، والمربوطين (زوز متحالفين في السر) يربحو مع بعضهم.' },
        { t: 'عقلك', d: 'كل واحد عندو 3 شمعات عقل. كل هجوم يطفي وحدة. كي تولّي 0 تولّي مسكون.' },
        { t: 'الليلة في 5 مراحل', d: 'الغروب (تحدّي) ← نصف الليل (هجوم سرّي) ← السهرة (نتحاكيو) ← الحكم (تصويت) ← الفجر (الحساب).' },
        { t: 'الصيّاد', d: 'اللي يربح التحدّي يهجم في السر على واحد في نصف الليل: ناقص عقل للّي اختارو.' },
        { t: 'الأغراض', d: 'الفانوس، السكين الصدّي، الملح، المراية: غرض واحد في الليلة، باش تحمي روحك ولا تهجم.' },
        { t: 'الربح', d: 'المربوطين يربحو كي يطيحو كل المنفردين. وإلا، آخر منفرد واقف يربح.' },
      ],
      sections: [
        { h: 'الأدوار', p: 'دورك سرّي: تليفونك برك يعرفو. حد ما يكشفو حتى للآخر.', list: [
          'منفرد: تلعب لروحك. تربح كان تبقى آخر منفرد واقف.',
          'مربوط: واحد من الضيوف مربوط بيك، أما ما تعرفش شكون. تربحو مع بعضكم كي يطيحو كل المنفردين.' ],
          ex: 'مع 5 لاعبين: 2 مربوطين و3 منفردين. مع 4 لاعبين: 2 مربوطين و2 منفردين.' },
        { h: '1. الغروب: التحدّي', p: 'الكل يلعب نفس التحدّي على تليفونو. فما 4 أنواع:', list: [
          'كويز مرعب: 3 أسئلة رعب. اللي يجاوب صحيح وبسرعة يربح.',
          'ذاكرة الضلام: احفظ تسلسل الرموز اللي يلمع.',
          'عيون القصر: المس العيون اللي تتحلّ وابعد على العناكب.',
          'الاعتراف الصحيح (خدعة): اخترع جواب يقنع، وبعدها لازم تلقاو الصحيح بين الاختراعات.' ],
          ex: 'الترتيب يعطي الأول الصيّاد. الاثنين الأولين ياخذو غرض من الحاجة (كان الجيب موش عامر: 3 أغراض أقصى).' },
        { h: '2. نصف الليل: الحركات السرّية', list: [
          'الصيّاد يختار هدف: يخسر عقل في الفجر.',
          'كل واحد ينجّم يستعمل غرض، واحد برك في الليلة (شوف التفاصيل تحت).',
          'المربوطين ينجّمو يهمسو مرة وحدة في اللعبة: تهمس لواحد. كان هو مربوط، توصلكم الزوز رنّة (« فلان هو المربوط متاعك »). وإلا، يسمع صوت بارد وإنت ما تسمع حتى رنّة.',
          'من الفصل 2، الصفقة: تاخذ غرض في الحين، أما تخسر عقل في الفجر (لازم عندك 2 عقل على الأقل ومكان في الجيب).' ],
          ex: 'سارة صيّاد وتضرب كريم. كريم يستعمل الفانوس: خسارة العقل تتلغى. حد ما يعرف شكون ضرب شكون حتى للفجر.' },
        { h: 'الأغراض الأربعة', list: [
          '🕯️ الفانوس: يلغي أول خسارة عقل في الليلة.',
          '🔪 السكين الصدّي: ناقص عقل لواحد، في السر.',
          '🧂 الملح: أي هجوم عليك في الليلة يرجع لصاحبو.',
          '🪞 المراية: تورّيك كان اللي قدامك مربوط ولا منفرد. انتبه: كي يبقالك عقل واحد برك، ينجّم تكذب.' ],
          ex: 'سارة تضرب كريم، وكريم استعمل الملح. الهجوم يرجع لسارة: عقلها من 3 ولّى 2.' },
        { h: 'الرونة السرّية', p: 'كل لاعب يشوف رونة على تليفونو. في أغلب الدورات، المربوطين يشوفو نفس الرونة: هذا دليلهم باش يتعرفو من غير ما يحكيو. بعض اللعنات تكشف رونة للكل.' },
        { h: '3. السهرة: نتحاكيو', p: 'وقت حرّ باش تحكيو بصوت عالي: تتّهمو، تكذبو، تقترحو تحالف. ما فماش قاعدة، كان الأحداث اللي تحت.' },
        { h: 'أحداث الحاجة', p: 'كل فجر، الحاجة ينجّم تعمل حدث لليلة الجاية:', list: [
          'الضلام: الشاشة تبقى سودا شوية.',
          'الهمس: كل واحد توصلو جملة خاصة، ينجّم تكون صحيحة وينجّم لا.',
          'الضباب (من الفصل 2): في الحكم، حد ما يعرف شكون صوّت لشكون.',
          'المسّ (من الفصل 2): واحد يصوّت اللي تأمرو بيه الحاجة.',
          'الصمت (من الفصل 2): ما فما كلمة، كان إشارات على التليفون.' ] },
        { h: '4. الحكم: التصويت', p: 'كل واحد يصوّت على اللي يشك فيه أكثر. اللي يجيب أكثر أصوات يخسر عقل. في التعادل، الحظ يقرّر.', ex: 'في الفصل 3، الحكم يقتل: اللي يجيب أكثر أصوات يموت، والصيّاد محمي.' },
        { h: '5. الفجر: الحساب', p: 'الشاشة تكشف، سطر بسطر، شكون خسر عقل وشكون طاح. وبعدها تبدا ليلة جديدة.' },
        { h: 'العقل، المسكونين والهلوسة', list: [
          'كي تولّي 0 عقل تولّي مسكون: ما تلعبش أكثر، أما كل ليلة المسكونين يختارو مع بعضهم لعنة من 3 (يطفيو غرض، يقصّرو السهرة، يكشفو رونة، يوشوشو صوت كذّاب، تصويت في الضلام).',
          'كي يبقالك عقل واحد، تهلوس: تليفونك يتلخبط، ينجّم توصلك أصوات كذّابة، والمراية ينجّم تكذب.' ] },
        { h: 'الفصول التلاتة', list: [
          'الفصل 1: الوصول. أول ليلتين، أحداث بسيطة.',
          'الفصل 2: النزول. كل الأحداث، والصفقة.',
          'الفصل 3: الدايرة الأخيرة (كي يبقاو 3 لاعبين ولا أقل). الحكم يقتل.',
          'من الليلة 9، الكل يخسر عقل في الفجر: اللعبة ما تنجّمش تطول للأبد.' ] },
        { h: 'كيفاش تربح', list: [
          'المربوطين يربحو كي يطيحو كل المنفردين.',
          'كان ما بقاش حتى مربوط، آخر منفرد واقف يربح.',
          'كان الكل طاح، الحاجة هي اللي تربح.' ] },
      ],
      faq: [
        { q: 'ننجّم نقول دوري؟', a: 'إيه، أما حد ما يضمن إنو صحيح. الكذب جزء من اللعبة.' },
        { q: 'شنوّة يعمل المسكون؟', a: 'يتفرّج، ما يحكيش، ويشارك في اللعنة الجماعية كل ليلة.' },
        { q: 'لاعب انقطع عليه الاتصال؟', a: 'ينجّم يرجع بنفس العنوان: بلاصتو تستناه.' },
      ],
    },
  },

  // ===================================================================== VILLAGE
  village: {
    fr: {
      title: 'Le Village maudit',
      intro: 'Une Bête se cache parmi les habitants. La nuit elle dévore, le jour le village vote pour chasser un suspect. 3 à 5 joueurs, une partie dure 20 à 30 minutes.',
      quick: [
        { t: 'Le but', d: 'Le village gagne en chassant toutes les Bêtes. Les Bêtes gagnent quand elles sont aussi nombreuses que les autres.' },
        { t: 'Ton rôle', d: 'Secret, sur ton téléphone : Bête, Guetteur, Guérisseur ou Villageois.' },
        { t: 'La nuit', d: 'Tout le monde ferme les yeux. La Bête choisit une proie, le Guetteur sonde quelqu’un, le Guérisseur protège quelqu’un.' },
        { t: 'L’aube', d: 'On découvre qui est mort. Son rôle est révélé.' },
        { t: 'Le jour', d: 'Le village discute à voix haute, puis chacun vote : le plus voté est chassé (et son rôle révélé).' },
        { t: 'Et on recommence', d: 'Nuit, aube, débat, vote… jusqu’à la victoire d’un camp.' },
      ],
      sections: [
        { h: 'Les rôles selon le nombre de joueurs', list: [
          '3 joueurs : 1 Bête, 1 Guetteur, 1 Guérisseur.',
          '4 joueurs : 1 Bête, 1 Guetteur, 1 Guérisseur, 1 Villageois.',
          '5 joueurs : 1 Bête, 1 Guetteur, 1 Guérisseur, 2 Villageois.' ] },
        { h: 'Ce que fait chaque rôle', list: [
          '🐺 La Bête : chaque nuit (à partir de la 2e), elle choisit un habitant à dévorer. Le jour, elle fait semblant d’être innocente.',
          '👁️ Le Guetteur : chaque nuit, il sonde un habitant et apprend s’il est une Bête ou innocent. À lui de convaincre le village sans se faire repérer.',
          '🌿 Le Guérisseur : chaque nuit, il protège un habitant (lui-même compris). Il ne peut pas protéger la même personne deux nuits de suite.',
          '🌾 Le Villageois : aucun pouvoir, mais une voix et un vote.' ] },
        { h: 'La nuit', p: 'Chacun agit sur son téléphone, en secret. Les Villageois (sans pouvoir) appuient simplement sur « Je me rendors », pour que personne ne devine qui a un pouvoir.', ex: 'La première nuit est calme : la Bête repère ses proies, mais personne ne meurt.' },
        { h: 'Les présages', p: 'À partir de la 2e nuit, un présage peut tomber, annoncé à tout le monde :', list: [
          'Brume : la vision du Guetteur peut mentir (une chance sur deux).',
          'Lune rouge : le remède du Guérisseur n’a aucun effet.' ] },
        { h: 'L’aube', p: 'Si la Bête a mordu quelqu’un que le Guérisseur n’a pas protégé, cette personne meurt et son rôle est révélé. Sinon, tout le monde est vivant, sans que l’on sache si quelqu’un a été sauvé.' },
        { h: 'Le débat', p: 'Le village discute à voix haute. On peut dire la vérité… ou mentir. Quand tout le monde est prêt, on passe au vote.', ex: 'Le Guetteur : « J’ai sondé Nour cette nuit, c’est la Bête ! » Mais Nour répond qu’elle est Guérisseuse… Qui croire ?' },
        { h: 'Le vote', p: 'Chacun désigne un suspect (pas lui-même) ou s’abstient. Le plus voté est chassé du village, son rôle est révélé. En cas d’égalité ou si personne ne vote, personne n’est chassé.' },
        { h: 'Comment on gagne', list: [
          'Le village gagne quand il ne reste plus de Bête.',
          'Les Bêtes gagnent quand elles sont aussi nombreuses que les autres habitants vivants.' ],
          ex: 'À 3 joueurs, si un innocent meurt, il ne reste que la Bête et un habitant : la Bête gagne aussitôt.' },
      ],
      faq: [
        { q: 'Les morts peuvent-ils parler ?', a: 'Non. Ils regardent en silence pour ne rien révéler aux vivants.' },
        { q: 'Le Guérisseur peut-il se protéger ?', a: 'Oui, mais pas deux nuits de suite.' },
        { q: 'Le rôle des morts est-il révélé ?', a: 'Oui, à l’aube pour la victime de la Bête et après le vote pour la personne chassée.' },
      ],
    },
    aeb: {
      title: 'القرية المسخوطة',
      intro: 'وحش مستخبّي بين أهل القرية. في الليل ياكل، وفي النهار القرية تصوّت باش تطرد واحد مشكوك فيه. من 3 حتى 5 لاعبين، والدورة تدوم 20 حتى 30 دقيقة.',
      quick: [
        { t: 'الهدف', d: 'القرية تربح كي تطرد كل الوحوش. الوحوش يربحو كي يولّيو بقدّ الباقين.' },
        { t: 'دورك', d: 'سرّي، على تليفونك: وحش، عرّاف، حكيم ولا ولد القرية.' },
        { t: 'في الليل', d: 'الكل يسكّر عيونو. الوحش يختار فريسة، العرّاف يكشف على واحد، والحكيم يحمي واحد.' },
        { t: 'الفجر', d: 'نعرفو شكون مات. دوره يتكشف.' },
        { t: 'في النهار', d: 'القرية تتحاكى بصوت عالي، وبعدها كل واحد يصوّت: اللي يجيب أكثر أصوات يتطرد (ودوره يتكشف).' },
        { t: 'ونعاودو', d: 'ليل، فجر، نقاش، تصويت… حتى يربح فريق.' },
      ],
      sections: [
        { h: 'الأدوار حسب عدد اللاعبين', list: [
          '3 لاعبين: وحش، عرّاف، حكيم.',
          '4 لاعبين: وحش، عرّاف، حكيم، ولد قرية.',
          '5 لاعبين: وحش، عرّاف، حكيم، زوز أولاد قرية.' ] },
        { h: 'شنوّة يعمل كل دور', list: [
          '🐺 الوحش: كل ليلة (من التانية) يختار واحد باش ياكلو. في النهار يتظاهر بالبراءة.',
          '👁️ العرّاف: كل ليلة يكشف على واحد ويعرف كان وحش ولا بريء. عليه يقنع القرية من غير ما يتفضح.',
          '🌿 الحكيم: كل ليلة يحمي واحد (ينجّم يكون هو). ما ينجّمش يحمي نفس الواحد ليلتين ورا بعضهم.',
          '🌾 ولد القرية: ما عندو حتى قدرة، أما عندو صوت وتصويت.' ] },
        { h: 'الليل', p: 'كل واحد يخدم على تليفونو في السر. أولاد القرية (من غير قدرة) يضغطو برك على « نعاود نرقد »، باش حد ما يخمّم شكون عندو قدرة.', ex: 'الليلة الأولى هادية: الوحش يختار فرايسو، أما حد ما يموت.' },
        { h: 'الفال', p: 'من الليلة التانية، ينجّم يطيح فال، يتعلن للكل:', list: [
          'الضباب: رؤية العرّاف ينجّم تكذب (فرصة على زوز).',
          'القمر الأحمر: دواء الحكيم ما عندو حتى تأثير.' ] },
        { h: 'الفجر', p: 'كان الوحش عضّ واحد والحكيم ما حماهش، هذاكا يموت ودوره يتكشف. وإلا الكل عايش، وما نعرفوش كان واحد تنقذ.' },
        { h: 'النقاش', p: 'القرية تتحاكى بصوت عالي. تنجّم تقول الحقيقة… ولا تكذب. كي الكل يولّي جاهز، نعدّيو للتصويت.', ex: 'العرّاف: « كشفت على نور الليلة، هي الوحش! » أما نور تجاوب إنها حكيمة… شكون نصدّقو؟' },
        { h: 'التصويت', p: 'كل واحد يختار مشكوك فيه (موش روحو) ولا يمتنع. اللي يجيب أكثر أصوات يتطرد من القرية ودوره يتكشف. كان فما تعادل ولا حد ما صوّت، حد ما يتطرد.' },
        { h: 'كيفاش تربح', list: [
          'القرية تربح كي ما يبقى حتى وحش.',
          'الوحوش يربحو كي يولّيو بقدّ أهل القرية الأحياء.' ],
          ex: 'مع 3 لاعبين، كان بريء مات، يبقى الوحش وواحد برك: الوحش يربح في الحين.' },
      ],
      faq: [
        { q: 'الميّتين ينجّمو يحكيو؟', a: 'لا. يتفرّجو في صمت باش ما يكشفو حتى حاجة للأحياء.' },
        { q: 'الحكيم ينجّم يحمي روحو؟', a: 'إيه، أما موش ليلتين ورا بعضهم.' },
        { q: 'دور الميّتين يتكشف؟', a: 'إيه، في الفجر لضحية الوحش، وبعد التصويت للّي تطرد.' },
      ],
    },
  },

  // ===================================================================== CRYPTE
  crypte: {
    fr: {
      title: 'La Crypte',
      intro: 'Un jeu coopératif : vous gagnez ou perdez tous ensemble. Chaque joueur détient des indices que les autres n’ont pas. 3 à 5 joueurs, 15 à 25 minutes.',
      quick: [
        { t: 'Le but', d: 'Traverser 4 salles de la crypte. Chaque porte cache un code de 4 symboles différents.' },
        { t: 'Tes indices', d: 'Sur ton téléphone, tu vois quelques indices. Seuls, les vôtres ne suffisent pas : il faut les dire à voix haute.' },
        { t: 'L’ouvreur', d: 'Un joueur (qui change à chaque salle) compose le code sur son téléphone quand le groupe est d’accord.' },
        { t: 'Les torches', d: 'Vous avez 5 torches. Chaque mauvais code éteint une torche. À 0, c’est perdu.' },
        { t: 'Le temps', d: 'Si le temps de la salle est écoulé, une torche s’éteint, le mur révèle un symbole, et vous gagnez 45 secondes.' },
        { t: 'La victoire', d: 'Ouvrez les 4 portes pour sortir vivants.' },
      ],
      sections: [
        { h: 'Les 6 symboles', p: 'Chaque code est formé de 4 symboles différents, parmi : 🌙 la lune, 💀 le crâne, 🕯️ la bougie, ⚰️ le cercueil, 🗝️ la clé, 🦇 la chauve-souris. L’ordre compte.' },
        { h: 'Les indices', p: 'Ils sont toujours vrais. Il y en a plusieurs types :', list: [
          '« La lune est en position 2. »',
          '« Le crâne n’est pas en position 1. »',
          '« La clé est dans le code » ou « La clé n’est pas dans le code. »',
          '« La bougie se trouve avant le cercueil. »',
          '« La lune et le crâne sont côte à côte. »',
          '« La clé est en position paire (ou impaire). »' ],
          ex: 'Sara a : « La lune est en position 2 ». Karim a : « Le crâne n’est pas dans le code ». Nour a : « La bougie est avant la clé ». Seuls, ils ne trouvent rien. Ensemble, ils réduisent les possibilités jusqu’à une seule.' },
        { h: 'La garantie', p: 'Avec tous les indices réunis, il n’y a qu’une seule solution. Et personne ne peut la trouver seul : le jeu vous force à parler.' },
        { h: 'L’ouvreur et l’essai', p: 'L’ouvreur touche les symboles dans l’ordre (4 symboles différents) puis valide. L’écran affiche le résultat : combien de symboles sont bien placés, combien sont dans le code mais mal placés. Ces informations sont un nouvel indice pour tout le monde.', ex: 'Essai 🌙 💀 🕯️ ⚰️ → « 1 bien placé · 2 mal placés » : un seul de ces symboles est à sa place, deux autres sont dans le code mais ailleurs.' },
        { h: 'Torches et temps', list: [
          'Vous partagez 5 torches pour toute la partie.',
          'Chaque salle dure 2 min 30. Si le temps est écoulé : −1 torche, un symbole est révélé sur l’écran, et +45 secondes.',
          'Si les torches tombent à 0, la crypte vous garde : vous avez perdu.' ] },
        { h: 'Les salles', p: 'Il y a 4 salles. À chaque salle, un nouvel ouvreur prend le relais, et de nouveaux indices sont distribués. Quand la 4e porte s’ouvre, vous êtes libres : les torches qu’il vous reste mesurent votre réussite.' },
      ],
      faq: [
        { q: 'Peut-on montrer son téléphone ?', a: 'Mieux vaut le dire à voix haute : c’est le principe du jeu. À vous de choisir vos règles de table.' },
        { q: 'Un symbole peut-il apparaître deux fois ?', a: 'Non. Les 4 symboles du code sont tous différents.' },
        { q: 'Que se passe-t-il si l’ouvreur se déconnecte ?', a: 'Il peut revenir avec la même adresse. Sinon, le temps de la salle s’écoule et la salle suivante a un autre ouvreur.' },
      ],
    },
    aeb: {
      title: 'الجبّانة',
      intro: 'لعبة تعاون: تربحو ولا تخسرو مع بعضكم. كل لاعب عندو أدلة الآخرين ما عندهمش. من 3 حتى 5 لاعبين، 15 حتى 25 دقيقة.',
      quick: [
        { t: 'الهدف', d: 'تعدّيو 4 بيوت في الجبّانة. كل باب يخبّي كود من 4 رموز مختلفين.' },
        { t: 'أدلتك', d: 'على تليفونك تشوف شوية أدلة. وحدكم الأدلة ما تكفيش: لازم تقولوها بصوت عالي.' },
        { t: 'اللي يفتح', d: 'لاعب (يتبدّل في كل بيت) يركّب الكود على تليفونو كي المجموعة تتّفق.' },
        { t: 'المشاعل', d: 'عندكم 5 مشاعل. كل كود غالط يطفي شعلة. كي تولّي 0، خسرتو.' },
        { t: 'الوقت', d: 'كي الوقت متاع البيت يخلص، شعلة تطفى، الحيط يكشف رمز، وتزيدو 45 ثانية.' },
        { t: 'الربح', d: 'حلّو الأبواب الأربعة باش تخرجو عايشين.' },
      ],
      sections: [
        { h: 'الرموز الستة', p: 'كل كود فيه 4 رموز مختلفين، من بين: 🌙 الهلال، 💀 الجمجمة، 🕯️ الشمعة، ⚰️ التابوت، 🗝️ المفتاح، 🦇 الخفّاش. الترتيب مهم.' },
        { h: 'الأدلة', p: 'الأدلة كلها صحيحة. فما برشا أنواع:', list: [
          '« الهلال في المكان 2. »',
          '« الجمجمة ماهيش في المكان 1. »',
          '« المفتاح موجود في الكود » ولا « المفتاح ما هوش في الكود. »',
          '« الشمعة تجي قبل التابوت. »',
          '« الهلال والجمجمة جنب بعضهم. »',
          '« المفتاح في مكان زوجي (ولا فردي). »' ],
          ex: 'سارة عندها: « الهلال في المكان 2 ». كريم عندو: « الجمجمة ما هيش في الكود ». نور عندها: « الشمعة قبل المفتاح ». وحدهم ما يلقاو حتى حاجة. مع بعضهم، الاحتمالات تنقص حتى يبقى واحد.' },
        { h: 'الضمان', p: 'كي تجمعو كل الأدلة، ما فما كان حلّ واحد. وحد ما ينجّم يلقاه وحدو: اللعبة تجبركم تحكيو.' },
        { h: 'اللي يفتح والمحاولة', p: 'اللي يفتح يلمس الرموز بالترتيب (4 رموز مختلفين) وبعدها يأكّد. الشاشة تورّي النتيجة: قدّاش من رمز في بلاصتو، وقدّاش في الكود أما في بلاصة غالطة. هذي المعلومات دليل جديد للكل.', ex: 'محاولة 🌙 💀 🕯️ ⚰️ ← « 1 في بلاصتو · 2 في بلاصة غالطة »: رمز واحد برك في بلاصتو، وزوز في الكود أما في بلاصة أخرى.' },
        { h: 'المشاعل والوقت', list: [
          'عندكم 5 مشاعل مشتركة في اللعبة كلها.',
          'كل بيت يدوم دقيقتين ونصف. كي الوقت يخلص: ناقص شعلة، رمز يتكشف على الشاشة، وتزيدو 45 ثانية.',
          'كي المشاعل تولّي 0، الجبّانة تحبسكم: خسرتو.' ] },
        { h: 'البيوت', p: 'فما 4 بيوت. في كل بيت، لاعب جديد يفتح، وأدلة جديدة تتوزّع. كي الباب الرابع يتحلّ، تولّيو أحرار: المشاعل اللي بقاو يقيسو نجاحكم.' },
      ],
      faq: [
        { q: 'ننجّم نورّي تليفوني؟', a: 'الأحسن تقولها بصوت عالي: هذا مبدأ اللعبة. وإنتم اللي تحدّدو قواعد الطاولة.' },
        { q: 'رمز ينجّم يتعاود مرتين؟', a: 'لا. الرموز الأربعة في الكود كلهم مختلفين.' },
        { q: 'كان اللي يفتح انقطع عليه الاتصال؟', a: 'ينجّم يرجع بنفس العنوان. وإلا الوقت يخلص والبيت الجاي يكون عندو لاعب آخر يفتح.' },
      ],
    },
  },
};

module.exports = { RULES };
