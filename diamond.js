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
    console.log('Get ' + num + ' gems');
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
      round.hazardCounts[hazardCard.hazardKind] += 1;

      if (round.hazardCounts[hazardCard.hazardKind] === 2) {
        console.log('*** HAZARD!!! ***');
        _.each(round.livingPlayers, function(player) { player.lostGem(); });
        round.livingPlayers = [];
      }
    };

    return func;
  };

  var Player = function() {
    this.name = '';
    this.storedGem = 0;
    this.acquiredGem = 0;
    this.backIntension = false;
  };

  Player.prototype = {
    question: function(_message, _commands) {},
    getGem: function(num) { this.acquiredGem += num; },
    lostGem: function() { this.acquiredGem = 0 },
    storeGem: function() {
      this.storedGem += this.acquiredGem;
      this.acquiredGem = 0;
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

  var Computer = function() {};
  Computer.prototype = new Player();
  Computer.prototype.question = function(_message, commands) {
    return commands['explore']();
  };

  var Round = function(number) {
    this.number = number;
    this.stackedCards = [];
    this.openedCards = [];

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
        this.backToBaseCamp();
        this.explore();
        this.putsStatus();
      }
    },

    choiceBackToBaseCamp: function() {
      var messages = [];

      _.each(this.livingPlayers, function(player) {
        player.question('Are you doing?', {
          explore: function() {
            messages.push(player.name + ': GO!');
            player.backIntension = false;
          },

          back: function() {
            messages.push(player.name + ': <<<');
            player.backIntension = true;
          }
        });
      });

      console.log(messages.join(', '));
    },

    backToBaseCamp: function() {
      var players = _.groupBy(this.livingPlayers, function(player) { return player.backIntension ? 'back' : 'explore'; });

      if (players['back']) {
        _.each(this.openedCards, function(card) {
          if (card.takeGem) { card.takeGem.call(card, players['back']); }
        });

        _.each(players['back'], function(player) { player.storeGem(); });
      }

      this.livingPlayers = players['explore'];
    },

    explore: function() {
      var card = this.stackedCards.shift();
      card.open();

      card.getDescription().call(card, this);
      this.openedCards.push(card);
    },

    putsStatus: function() {
      var cardHistories = [];

      _.each(this.openedCards, function(card) {
        var simpleDescription = (card.type == 'tresure' ? card.surplusGem : card.hazardKind);
        cardHistories.push('[' + simpleDescription + ']');
      });

      console.log('');
      console.log('RoundHistory: ' + cardHistories.join(''));

      var playerStatus = [];

      _.each(this.players, function(player) {
        playerStatus.push('{ name: "' + player.name + '", gem: ' + player.acquiredGem + ', totalGem: ' + player.storedGem + ' }');
      });

      console.log('PlayerStatus: [' + playerStatus.join(",\n") + ']\n');
    }
  };

  var Deck = function() {};

  var Game = function() {
    this.players = [];
    this.rounds = [];
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
        var computer = new Computer();
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

      _.each(this.rounds, function(round) {
        round.setup(players);
        round.start();
      });
    }
  };

  var game = new Game;
  game.setup(4, 5);
  game.start();
})();
