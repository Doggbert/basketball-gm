/**
 * @name core.finances
 * @namespace Anything related to budget/finances.
 */
define(["db", "globals"], function (db, g) {
    "use strict";

    /**
     * Assess the payroll and apply minimum and luxury taxes.
     *
     * @param {function()} cb Callback function.
     */
    function assesPayrollMinLuxury(cb) {
        var i, getPayroll, payrolls, tx;

        payrolls = [];
        getPayroll = function (tx, tid) {
            db.getPayroll(tx, tid, function (payroll) {
                payrolls[tid] = payroll;
            });
        };

        // First, get all the current payrolls
        tx = g.dbl.transaction(["players", "releasedPlayers"]);
        for (i = 0; i < g.numTeams; i++) {
            getPayroll(tx, i);
        }
        tx.oncomplete = function () {
            var tx;

            // Update teams object store
            tx = g.dbl.transaction(["teams"], "readwrite");
            tx.objectStore("teams").openCursor().onsuccess = function (event) {
                var cursor, i, team;

                cursor = event.target.result;
                if (cursor) {
                    team = cursor.value;
                    i = team.seasons.length - 1;  // Relevant row is the last one

                    // Store payroll
                    team.seasons[i].payrollEndOfSeason = payrolls[team.tid];

                    // Assess minimum payroll tax and luxury tax
                    if (payrolls[team.tid] < g.minPayroll) {
                        team.seasons[i].minTaxPaid = g.minPayroll - payrolls[team.tid];
                        team.seasons[i].cash -= team.seasons[i].minTaxPaid;
                    } else if (payrolls[team.tid] > g.luxuryPayroll) {
                        team.seasons[i].luxuryTaxPaid = g.luxuryTax * (payrolls[team.tid] - g.luxuryPayroll);
                        team.seasons[i].cash -= team.seasons[i].luxuryTaxPaid;
                    }

                    cursor.update(team);
                    cursor.continue();
                }
            };
            tx.oncomplete = function () {
                cb();
            };
        };

    }

    return {
        assesPayrollMinLuxury: assesPayrollMinLuxury
    };
});