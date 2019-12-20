const lua_url = 'https://5onemratgi.execute-api.us-east-1.amazonaws.com/default/interpret-lua';
const phenotype_id = 368;
const api_key = 'jkX8LOOWuf62xGfzWO8uD5N0AqcsnHHnjv9BT9Y2';

const markers_to_search = [
	'rs5082',
	'rs7679',
	'rs174547',
	'rs174550',
	'rs247616',
	'rs340874',
	'rs471364',
	'rs515135',
	'rs560887',
	'rs714052',
	'rs780094',
	'rs964184',
	'rs1260326',
	'rs1501908',
	'rs1800588',
	'rs1800961',
	'rs1801282',
	'rs1883025',
	'rs2241201',
	'rs2271293',
	'rs2338104',
	'rs2650000',
	'rs2954029',
	'rs2967605',
	'rs3846663',
	'rs4607517',
	'rs4846914',
	'rs4939883',
	'rs6102059',
	'rs6511720',
	'rs6544713',
	'rs7034200',
	'rs7557067',
	'rs7819412',
	'rs7903146',
	'rs7944584',
	'rs9939609',
	'rs10401969',
	'rs10468017',
	'rs10830963',
	'rs10850219',
	'rs10885122',
	'rs10889353',
	'rs11206510',
	'rs11605924',
	'rs11708067',
	'rs11920090',
	'rs12678919',
	'rs12740374',
	'rs17216525',
	'rs17300539'
];

const sources = ["file23andMe", "fileAncestry"];

const markers_request = {
    "phenotypes":[phenotype_id],
    "markers":{}
}

var diet_message = "";

async function process_file(file) {
	let source = file.id;
	if (sources.includes(source)) {
		clear_file_sources(source);
		change_file_loading_status();
		change_spinner_status();

		diet_message = "";

		let markers = false;
		try {
			let process_file;
			if (source == "file23andMe") {
				process_file = process_file_23andMe;
			} else if (source == "fileAncestry") {
				process_file = process_file_Ancestry;
			}
			markers = await process_file(file);
		} catch (error) {
			console.log(error.name + ": " + error.message + "\nSource: " + error.stack);
			showSimpleModal("<p>Couldn't get enough data from the file." +
					"<p>You have to choose it manually using 'Configure' menu." +
					"<p>Balanced Diet (Mediterranean) is the most recommended for health, ceteris paribus.");
		}

		let result_from_lua = false;
		if (markers) {
			try {
				result_from_lua = await request_lua(markers);
			} catch (error) {
				console.log(error.name + ": " + error.message + "\nSource: " + error.stack);
				showSimpleModal("<p>Couldn't get the diet definition." +
					"<p>Try later or choose the diet manually using 'Configure' menu." +
					"<p>Balanced Diet (Mediterranean) is the most recommended for health, ceteris paribus.");
			}
		}

		if (result_from_lua) {
			let log_message = "Results: ";
			if (result_from_lua.length > 75) {
				log_message += result_from_lua.substr(0, 75);
			} else {
				log_message += result_from_lua;
			}
			log_message += "\n...";
			console.log(log_message);
			let outcome = false;
			let res = JSON.parse(result_from_lua);
			if (res) {
				outcome = res[phenotype_id]["outcome"];
			}
			if (outcome) {
				diet_message = outcome;
				if (outcome == "Balanced Diet") {
					outcome += " (Mediterranean)";
				}
				showSimpleModal("According to your DNA test your recommended diet is <strong>" +
					outcome + "</strong>.");
			} else {
				showSimpleModal("<p>Your diet isn't implemented." +
					"<p>You have to choose it manually using 'Configure' menu." +
					"<p>Balanced Diet (Mediterranean) is the most recommended for health, ceteris paribus.");
			}
		}

		change_file_loading_status();
		change_spinner_status();
	} else {
		console.log("Unknown source");
	}
}

function process_file_23andMe(e_file) {
	return new Promise(function (resolve, reject) {
		let file = e_file.files[0];
		let reader = new FileReader();
		reader.onload = function(progressEvent) {
			console.log("23andMe file is processed");
			let markers = {};
			let lines = this.result.split(/\r\n|\n|\r/);
			console.log("lines count: " + lines.length);
			row = 0;
			while (row < lines.length && lines[row++].trim().toLowerCase() != "# rsid	chromosome	position	genotype") {}
			if (row < lines.length) {
				let line = lines[row++].trim();
				while (row < lines.length && line != "") {
					let gene_parts = line.split('\t', 4);
					let alleles = gene_parts[3];
					let a1 = "";
					let a2 = "";
					if (alleles.length == 1) {
						a1 = alleles[0];
						a2 = alleles[0];
					} else if (alleles.length == 2) {
						a1 = alleles[0];
						a2 = alleles[1];
					} else {
						console.log("Strange genotype: " + gene_parts[0] + '(' + alleles + ') in line#' + row);
					}
					let gt = gene_parts[0];
					if (markers_to_search.includes(gt)) {
						markers[gt] = [gt, a1, a2];
					}
					line = lines[row++].trim();
				}
			}

			let markers_count = Object.keys(markers).length;
			console.log("Markers found: " + markers_count);
			if (markers_count > 0) {
				console.log(JSON.stringify(markers));
				resolve(markers);
			} else {
				let error = new Error("The markers are not found");
				error.name = "PWdnafileError";
				reject(error);
			}
		};
		reader.readAsText(file);
	});
}

function process_file_Ancestry(e_file) {
	return new Promise(function (resolve, reject) {
		let file = e_file.files[0];
		let reader = new FileReader();
		reader.onload = function(progressEvent) {
			console.log("Ancestry file is processed");
			let markers = {};
			let lines = this.result.split(/\r\n|\n|\r/);
			console.log("lines count: " + lines.length);
			row = 0;
			while (row < lines.length && lines[row++].trim().toLowerCase() != "rsid	chromosome	position	allele1	allele2") {}
			if (row < lines.length) {
				let line = lines[row++].trim();
				while (row < lines.length && line != "") {
					let gene_parts = line.split('\t', 5);
					let gt = gene_parts[0];
					if (markers_to_search.includes(gt)) {
						markers[gt] = [gt, gene_parts[3], gene_parts[4]];
					}
					line = lines[row++].trim();
				}
			}

			let markers_count = Object.keys(markers).length;
			console.log("Markers found: " + markers_count);
			if (markers_count > 0) {
				console.log(JSON.stringify(markers));
				resolve(markers);
			} else {
				let error = new Error("The markers are not found");
				error.name = "PWdnafileError";
				reject(error);
			}
		};
		reader.readAsText(file);
	});
}

function request_lua(markers) {
	return new Promise(function (resolve, reject) {
		let xhttp = new XMLHttpRequest();
		xhttp.onload = function () {
			resolve(xhttp.responseText);
		};
		xhttp.onerror = function () {
			let error = new Error("Failed to access pgz service: Error code: " + this.status + " Response text: "  + this.responseText);
			error.name = "PWpgzError";
			reject(error);
		};
		xhttp.timeout = 10000;
		xhttp.open("POST", lua_url, true);
		xhttp.setRequestHeader("Content-Type", "application/json");
		xhttp.setRequestHeader("Accept", "*/*");
		xhttp.setRequestHeader("x-api-key", api_key);
		markers_request["markers"] = markers;
		xhttp.send(JSON.stringify(markers_request));
	});
}

function postMessage() {
	console.log("Post message: " + diet_message);
	try{
		if (webkit && webkit.messageHandlers && webkit.messageHandlers.callbackHandler) {
			webkit.messageHandlers.callbackHandler.postMessage(diet_message);
		}
    Print.postMessage('Hello World being called from Javascript code');
	} catch (error) {
			console.log(error.name + ": " + error.message + "\nSource: " + error.stack);
	}
}

function showSimpleModal(message){
	$('#simple_modalTitle').html(message);
	$('#simple_modal').modal('show');
}

function clear_file_sources(source) {
	// clear all the file sources but the passed
	for (s of sources) {
		if (s != source) {
			document.getElementById(s).value = "";
		}
	}
}

function change_file_loading_status() {
	for (s of sources) {
		let btn = document.getElementById(s);
		btn.disabled = !btn.disabled;
	}
}

function change_spinner_status() {
	const spinner = document.getElementById("spinner");
	if (spinner && spinner.classList) {
		spinner.classList.toggle("d-none");
	}
}
