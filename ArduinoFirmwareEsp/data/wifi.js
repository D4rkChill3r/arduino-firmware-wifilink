var currAp = "";
var blockScan = 0;
var attempt = 0;
var networkAlert = "Diese Aktion erfordert einen Neustart. Möchten Sie fortfahren?";

function createInputForAp(b) {
    if (b.essid == "" && b.rssi == 0) {
        return
    }
    var g = e("input");
    g.type = "radio";
    g.name = "essid";
    g.value = b.essid;
    g.id = "opt-" + b.essid;
    if (currAp == b.essid) {
        g.checked = "1"
    }
    var i = e("div");
    var j = -Math.floor(b.rssi / 51) * 32;
    i.className = "lock-icon";
    i.style.backgroundPosition = "0px " + j + "px";
    var d = e("div");
    d.innerHTML = "" + b.rssi + "dB";
    var c = e("div");
    var h = "-64";
    if (b.enc == "0") {
        h = "0"
    }
    if (b.enc == "1") {
        h = "-32"
    }
    c.className = "lock-icon";
    c.style.backgroundPosition = "-32px " + h + "px";
    var f = e("div");
    f.innerHTML = b.essid;
    var a = m('<label for="opt-' + b.essid + '"></label>').childNodes[0];
    a.appendChild(g);
    a.appendChild(c);
    a.appendChild(i);
    a.appendChild(d);
    a.appendChild(f);
    return a
}

function getSelectedEssid() {
    var c = document.forms.wifiform.elements;
    for (var b = 0; b < c.length; b++) {
        if (c[b].type == "radio" && c[b].checked) {
            var a = c[b].value;
            if (a == "_hidden_ssid_") {
                a = $("#hidden-ssid").value
            }
            return a
        }
    }
    return currAp
}
var scanTimeout = null;
var scanReqCnt = 0;

function scanResult() {
    if (scanReqCnt > 60) {
        return scanAPs()
    }
    scanReqCnt += 1;
    ajaxJson("GET", "wifi/scan", function (c) {
        currAp = getSelectedEssid();
        if (c.result.APs.length > 0) {
            $("#aps").innerHTML = "";
            var d = 0;
            for (var b = 0; b < c.result.APs.length; b++) {
                if (c.result.APs[b].essid == "" && c.result.APs[b].rssi == 0) {
                    continue
                }
                $("#aps").appendChild(createInputForAp(c.result.APs[b]));
                d = d + 1
            }
            enableNetworkSelection();
            $("#spinner").setAttribute("hidden", "");
            showNotification("" + d + " Netzwerke gefunden");
            var a = $("#connect-button");
            a.className = a.className.replace(" pure-button-disabled", "");
            if (scanTimeout != null) {
                clearTimeout(scanTimeout)
            }
        }
        else {
            showWarning("Keine Netzwerke gefunden.")
        }
    }, function (b, a) {
        $("#spinner").setAttribute("hidden", "");
        showWarning("Bitte erneut Scannen")
    })
}

function scanAPs() {
    $("#spinner").removeAttribute("hidden");
    window.scrollTo(0, 0);
    if (blockScan) {
        scanTimeout = window.setTimeout(scanAPs, 1500);
        return
    }
    ajaxReq("GET", "wifi/netNumber", function (a){
        scanTimeout = null;
        scanReqCnt = 0;
        scanResult();
    }, function(b,a){
        $("#spinner").setAttribute("hidden", "");
        showWarning("Fehler beim Scann, bitter erneut versuchen.")
    })
    
}

function getStatus() {
    ajaxJsonSpin("GET", "connstatus", function (c) {
        if (c.status == "idle" || c.status == "connecting") {
            $("#aps").innerHTML = "Verbinde...";
            showNotification("Verbinde...");
            window.setTimeout(getStatus, 1000)
        }
        else {
            if (c.status == "got IP address") {
                var a = "Verbunden! IP " + c.ip;
                showNotification(a);
                showWifiInfo(c);
                blockScan = 0;
                if (c.modechange == "yes") {
                    var b = "esp wechselt in wenigen Sekunden in den Nur-STA-Modus";
                    window.setTimeout(function () {
                        showNotification(b)
                    }, 4000)
                }
                $("#reconnect").removeAttribute("hidden");
                $("#reconnect").innerHTML = 'Wenn Sie sich im selben Netzwerk befinden, gehen Sie zu <a href="http://' + c.ip + '/">' + c.ip + "</a>, andernfalls stellen Sie eine Verbindung zum Netzwerk:" + c.ssid + " her."
            }
            else {
                blockScan = 0;
                showWarning("Verbindung fehlgeschlagen");
                $("#aps").innerHTML = 'Überprüfen Sie das Passwort und den ausgewählten AP. <a href="wifi.html">Zurück</a>'
            }
        }
        enableNetworkSelection()
    }, function (b, a) {
        if (attempt < 3) {
            showWarning("Verbindungsprobleme ... Ich versuche es erneut.");
            window.setTimeout(hideWarning, 3000);
            window.setTimeout(getStatus, 2000);
            attempt++;
        }
        else {
            showWarning("Verbindung fehlgeschlagen. \nVerbinde dich mit AP");
            attempt = 0;
            blockScan = 0;
        }
    })
}

function changeWifiMode(a) {
    if (confirm(networkAlert)) {
        blockScan = 1;
        hideWarning();
        ajaxSpin("GET", "setmode?mode=" + a, function (b) {
            showNotification("Modus gewechselt");
            window.setTimeout(getWifiInfo, 100);
            blockScan = 0;
            window.setTimeout(enableNetworkSelection, 500)
        }, function (c, b) { //b is the error message, sometimes is empty
            showWarning("Fehler beim Moduswechsel");
            window.setTimeout(getWifiInfo, 100);
            blockScan = 0;
            window.setTimeout(enableNetworkSelection, 500)
        })
    }
}

function changeWifiAp(d) {
    if (confirm(networkAlert)) {
        d.preventDefault();
        var b = $("#wifi-passwd").value;
        var f = getSelectedEssid();
        showNotification("Verbinde mit " + f);
        var c = "connect?essid=" + encodeURIComponent(f) + "&passwd=" + encodeURIComponent(b);
        hideWarning();
        $("#reconnect").setAttribute("hidden", "");
        $("#wifi-passwd").value = "";
        var a = $("#connect-button");
        var g = a.className;
        a.className += " pure-button-disabled";
        blockScan = 1;
        ajaxSpin("GET", c, function (h) {
            if(h==1)
                window.setTimeout(function(){
                    $("#spinner").removeAttribute("hidden");
                    showNotification("Warte auf Netzwerkwechsel ...");
                    window.scrollTo(0, 0);
                    window.setTimeout(getStatus, 2000)
                },10000);
        }, function (i, h) {
            showWarning("Fehler beim Netzwerkwechsel: " + h);
            a.className = g;
			blockScan = 0;
        })
    }
}

function changeSpecial(c) {
    if (confirm(networkAlert)) {
        c.preventDefault();
        var b = "special";
        b += "?dhcp=" + document.querySelector('input[name="dhcp"]:checked').value;
        b += "&staticip=" + encodeURIComponent($("#wifi-staticip").value);
        b += "&netmask=" + encodeURIComponent($("#wifi-netmask").value);
        b += "&gateway=" + encodeURIComponent($("#wifi-gateway").value);
        hideWarning();
        var a = $("#special-button");
        addClass(a, "pure-button-disabled");
        ajaxSpin("GET", b, function (d) {
            removeClass(a, "pure-button-disabled")
            if (d != 1) {
                alert("IP gesetzt. Weiterleitung zu: " + JSON.parse(d).url);
                setTimeout(document.location.href = "http://" + JSON.parse(d).url + "/wifi.html", 1000);
            }
            else showNotification("DHCP aktiviert");
        }, function (f, d) {
            showWarning("Fehler: " + d);
            removeClass(a, "pure-button-disabled");
            getWifiInfo();
        })
    }
}

function changeHostname() {
    if (confirm(networkAlert)) {
        var a = $("#change-hostname-input").value;
        if (a == "") {
            alert("Hostname eingeben!")
        }
        else {
            ajaxSpin("GET", "/system/update?name=" + a, function () {
                showHostnameModal(a)
            })
        }
    }
}

function showHostnameModal(b) {
    var a = "Hostname geändert in : " + b; //+ "\nYour board will be reboot to apply change";
    var c = confirm(a);
    if (c == false) alert("Error in hostname change");
}

function hostnameLimitations(c) {
    var b = new RegExp("^[a-zA-Z0-9\-_\b]+$");
    var a = String.fromCharCode(!c.charCode ? c.which : c.charCode);
    if (!b.test(a)) {
        c.preventDefault();
        return false
    }
}

function enableNetworkSelection() {
    ajaxJson("GET", "/wifi/info", function (j) {
        var a = (j.mode == "STA");
        var h = document.getElementById("wifiform")
            , c = h.getElementsByTagName("input")
            , f = $("#connect-button")
            , s = $("#scan-button");
        var g, d = 0;
        while (g = c[d++]) {
            g.disabled = a
        }
        f.disabled = a;
        s.disabled = a;
        if (a) {
            bnd(h, "mouseover", displayWiFiModeAlert);
            bnd(h, "mouseout", hideWiFiModeAlert)
            toggleClass(f, "pure-button-disabled")
        }
        else {
            ubnd(h, "mouseover", displayWiFiModeAlert);
            ubnd(h, "mouseout", hideWiFiModeAlert)
            removeClass(f, "pure-button-disabled")
        }
    })
}

function displayWiFiModeAlert() {
    $("#alertWiFiMode").style.display = "inherit"
}

function hideWiFiModeAlert() {
    $("#alertWiFiMode").style.display = "none"
}

function doDhcp() {
    $("#dhcp-on").removeAttribute("hidden");
    $("#dhcp-off").setAttribute("hidden", "")
}

function doStatic() {
    $("#dhcp-off").removeAttribute("hidden");
    $("#dhcp-on").setAttribute("hidden", "")
};