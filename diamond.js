'use strict';

(function () {
  var readline = require('readline-sync');
  var _ = require('underscore')

  var HAZARD_KINDS = ['lava', 'rockfall', 'snake', 'mummy', 'spider'];

  var QuestCard = function() {};
  QuestCard.prototype = {
    open: function() {
      console.log('Opened "' + this.name + '"');
    },
    getDescription: function() {}
  };

  var TresureCard = function(gem) {
    this.name = gem + ' gems';
    this.totalGem = gem;
    this.surplusGem = gem;
  };

  TresureCard.prototype = new QuestCard;
  TresureCard.prototype.type = 'tresure';
  TresureCard.prototype.getDescription = function() {
    var tresureCard = this;

    var func = function(round) {
      var players = round.livingPlayers;
      tresureCard.takeGem(players);
    };

    return func;
  };
  TresureCard.prototype.takeGem = function(players) {
    var num = Math.floor(this.surplusGem / players.length);

    _.each(players, function(player) { player.getGem(num); });
    this.surplusGem = this.surplusGem % players.length;
  };

  var HazardCard = function(name) {
    this.name = name;
    this.hazardKind = name;
  };

  HazardCard.prototype = new QuestCard;
  HazardCard.prototype.type = 'hazard';
  HazardCard.prototype.getDescription = function() {
    var hazardCard = this;

    var func = function(round) {
      round.hazardCount += 1;
      round.hazardCounts[hazardCard.hazardKind] += 1;

      _.each(round.livingPlayers, function(player) { player.getGem(0); });

      if (round.hazardCounts[hazardCard.hazardKind] === 2) {
        console.log('*** HAZARD!!! ***');
        _.each(round.livingPlayers, function(player) { player.die(); });
        round.livingPlayers = [];
      }
    };

    return func;
  };

  var Player = function() {
    this.name = '';
    this.storedGems = [0];
    this.acquiredGems = [0];
    this.state = '';
  };

  Player.prototype = {
    question: function(_message, _commands) {},
    initStatus: function() {
      this.acquiredGems = [0];
      this.state = '';
    },
    getGem: function(num) {
      this.acquiredGems.push(num);
    },
    die: function() {
      this.storedGems.push(0);
      this.acquiredGems = [0];
      this.state = 'die';
    },
    returnToBaseCamp: function() {
      this.storedGems.push(this.countAcquiredGem());
      this.acquiredGems = [0];
      this.state = 'returned';
    },
    countStoredGem: function() {
      return _.reduce(this.storedGems, function(memo, num) { return memo + num; }, 0);
    },
    countAcquiredGem: function() {
      return _.reduce(this.acquiredGems, function(memo, num) { return memo + num; }, 0);
    },
    countStoredgem: function() {
      return _.last(this.storedGems);
    },
    countIncrementOfAcquiredGem: function() {
      return _.last(this.acquiredGems);
    },
    humanState: function() {
      switch (this.state) {
        case 'go':
          return '進む';
        case 'return':
          return '戻る';
        case 'returned':
          return '帰還済み';
        case 'die':
          return '気絶';
        default:
          return '開始待ち';
      }
    }
  };

  var Human = function() {};
  Human.prototype = new Player();
  Human.prototype.question = function(message, commands) {
    var commandNames = Object.keys(commands);
    var commandLength = commandNames.length;
    var promptMessage = this.name + ": " + message + ' [' + commandNames.join(', ') + '] >> ';

    while (true) {
      var value = readline.question(promptMessage);
      for (var i = 0; i < commandLength; i++) {
        if (commandNames[i] === value) { return commands[value](); };
      }
    }
  };

  var Computer = function(game) {
    this.game = game;
    this.storedGems = [0];
    this.acquiredGems = [0];
  };
  Computer.prototype = new Player();
  Computer.prototype.question = function(_message, commands) {

    if (_.random(0, 100) < this.calcHazardValue()) {
      return commands['return']();
    } else {
      return commands['go']();
    }
  };
  Computer.prototype.calcHazardValue = function(_message, commands) {
    var currentRound = this.game.currentRound;

    // 戻っても絶対増えない状況では戻らない
    if ((this.countAcquiredGem() + currentRound.allSurplusGem()) === 0) { return -100; }

    // (危険度**3) + 獲得宝石数 + (残されている宝石数 * 3) - 10 - (トッププレイヤーに負けているときだけ、(ラウンド数 * 2) ** 2)
    var hazardValue = Math.pow(currentRound.hazardCount, 3) + this.countAcquiredGem() + (currentRound.allSurplusGem() * 3) - 10 - (game.topPlayer().countStoredGem() > (this.countStoredGem() + this.countAcquiredGem()) ? Math.pow(currentRound.number, 2) : 0) - (game.topPlayer().countStoredGem() > (this.countStoredGem() + this.countAcquiredGem() + currentRound.allSurplusGem()) ? Math.pow(currentRound.number, 2) : 0);
    return hazardValue;
  };

  var Round = function(number) {
    this.number = number;
    this.stackedCards = [];
    this.openedCards = [];
    this.hazardCount = 0;

    this.hazardCounts = _.reduce(HAZARD_KINDS, function(memo, hazardKind) {
      var obj = {}
      obj[hazardKind] = 0;
      return _.extend(memo, obj);
    }, {});

    this.players = [];
    this.livingPlayers = [];
  };

  Round.prototype = {
    setup: function(players) {
      var stackedCards = this.stackedCards;
      this.players = players;
      this.livingPlayers = players;

      _.each(this.players, function(player) { player.initStatus() });

      _.each(_.range(1, 24), function(num) {
        var card = new TresureCard(num);
        stackedCards.push(card);
      });

      _.each(HAZARD_KINDS, function(hazardKind) {
        for (var i = 0; i < 4; i++) {
          var card = new HazardCard(hazardKind);
          stackedCards.push(card);
        }
      });

      this.stackedCards = _.shuffle(stackedCards);
    },

    start: function() {
      console.log('### Round ' + this.number + ' start ###');

      while (this.livingPlayers.length > 0) {
        this.choiceBackToBaseCamp();
        this.returnPlayersToBaseCamp();
        this.explore();
        this.putsStatus();
      }
    },

    choiceBackToBaseCamp: function() {
      _.each(this.livingPlayers, function(player) {
        player.question('Are you doing?', {
          'go': function() {
            player.state = 'go';
          },

          'return': function() {
            player.state = 'return';
          }
        });
      });

      this.putsPlayerStates();
    },

    returnPlayersToBaseCamp: function() {
      var players = _.groupBy(this.livingPlayers, function(player) { return player.state; });

      if (players['return']) {
        _.each(this.openedCards, function(card) {
          if (card.takeGem) { card.takeGem.call(card, players['return']); }
        });

        _.each(players['return'], function(player) { player.returnToBaseCamp(); });
      }

      if (!players['go']) { players['go'] = []; }
      this.livingPlayers = players['go'];
    },

    explore: function() {
      var card = this.stackedCards.shift();
      card.open();

      card.getDescription().call(card, this);
      this.openedCards.push(card);
    },

    putsPlayerStates:function() {
      var messages = [];
      var rawTemplate = '| <%= name %> | state: <%= state %> |'
      var template = _.template(rawTemplate);

      messages.push('|-------------|-----------------|');

      _.each(this.players, function(player) {
        var name = player.name + Array(12 - player.name.length).join(' ');
        var state = Array(5 - player.humanState().length).join('　') + player.humanState();
        messages.push(template({ 'name': name, 'state': state }));
      });

      messages.push('|-------------|-----------------|');

      console.log(messages.join("\n"));
      readline.question("\n*** HIT ANY KEY ***");
    },

    putsStatus: function() {
      var cardHistories = [];

      _.each(this.openedCards, function(card) {
        var simpleDescription = (card.type == 'tresure' ? card.surplusGem : card.hazardKind);
        cardHistories.push('[' + simpleDescription + ']');
      });

      console.log('');
      console.log('RoundHistory: ' + cardHistories.join(''));

      var messages = [];
      var rawTemplate = '| <%= name %> | gem: <%= gem %><%= incrementOfGem %> | totalGem: <%= totalGem %> | state: <%= state %> |'
      var template = _.template(rawTemplate);

      messages.push('|-------------|--------------|--------------|-----------------|');

      _.each(this.players, function(player) {
        var name = player.name + Array(12 - player.name.length).join(' ');
        var gem = Array(3 - player.countAcquiredGem().toString().length).join(' ') + player.countAcquiredGem().toString();
        var totalGem = Array(3 - player.countStoredGem().toString().length).join(' ') + player.countStoredGem().toString();
        var state = Array(5 - player.humanState().length).join('　') + player.humanState();
        var incrementOfGem = (function() {
          var text = '(+' + player.countIncrementOfAcquiredGem() + ')';
          return (text === '(+0)') ? '     ' : (text + Array(6 - text.length).join(' '));
        })();
        messages.push(template({ 'name': name, 'gem': gem, 'incrementOfGem': incrementOfGem, 'totalGem': totalGem, 'state': state }));
      });

      messages.push('|-------------|--------------|--------------|-----------------|');
      console.log(messages.join("\n"));

      // debug
      // if (true) {
      //  _.each(this.players, function(player) {
      //    if (player.calcHazardValue) { console.log(player.calcHazardValue()); }
      //  });
      //};

      readline.question("\n*** HIT ANY KEY ***");
    },

    allSurplusGem: function() {
      var tresureCards = _.filter(this.openedCards, function(card) { return card.type === 'tresure' });
      var result = 0;

      if (tresureCards.length > 0) {
        result = _.reduce(tresureCards, function(memo, card) { return memo + card.surplusGem; }, 0);
      }

      return result;
    }
  };

  var Deck = function() {};

  var Game = function() {
    this.players = [];
    this.rounds = [];
    this.currentRound = null;
  };

  Game.prototype = {
    setup: function(playerCount, roundCount) {
      var humanCount = 1;
      var computerCount = playerCount - humanCount;

      for (var i = 1; i <= humanCount; i++) {
        var human = new Human();
        human.name = 'Human ' + i;
        this.players.push(human);
      }

      for (var i = 1; i <= computerCount; i++) {
        var computer = new Computer(this);
        computer.name = 'Computer ' + i;
        this.players.push(computer);
      }

      for (var i = 1; i <= roundCount; i++) {
        var round = new Round(i);
        this.rounds.push(round);
      }
    },

    start: function() {
      var players = this.players;
      var game = this;

      _.each(this.rounds, function(round) {
        game.currentRound = round;
        round.setup(players);
        round.start();
      });
    },

    topPlayer: function() {
      return _.max(this.players, function(player) { return player.countStoredGem(); });
    }
  };

  var game = new Game;
  var numberOfPlayer = (function() {
    while (true) {
      var value = readline.question('何人で遊びますか？[3〜12]');
      var nums = _.range(3, 13);
      var numsLength = nums.length;
      for (var i = 0; i < numsLength; i++) {
        if (nums[i].toString() === value) { return nums[i]; }
      }
    }
  })();
  game.setup(numberOfPlayer, 5);
  game.start();
})();
