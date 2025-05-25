// receive file 
document.getElementById("startButton")
        .addEventListener('click', 
          function(event){
            const input_file = document.getElementById('fileInput').files[0]; 
            if(input_file == null){
              console.log("bad input"); 
              return;
            }
            console.log('nonnull input', input_file); 

            const reader = new FileReader(); 
            reader.onload = () => {
              // do stuff with the file
              processData(reader.result);  
            }
            reader.onerror = () => {
              console.log("error"); 
            }
            reader.readAsText(input_file);
          }
);

async function processData(csv_string){
  const data = d3.csvParse(csv_string, function(d, i) {
    return d; 
  });

  console.log(data);

  // general life stats
  genLifeStats(data); 

  genBooksByYearBarGraph(data); 

  // wikidata
  var read_data = data.filter(function(d){
    return d["Exclusive Shelf"] == "read"; 
  });
  console.log("testing"); 
  const res = await queryWikiDataAuthor("Jules Verne");
  console.log(res);  

  console.log(read_data); 
  var author_wikidata = await getAuthorWikidata(read_data); 
  console.log(author_wikidata); 
  
  // gender break down 
  genBooksByGenderPieChart(data, author_wikidata); 

  // Country breakdown
  // citizenship
  
  // birth 

  // sexual orientation - if I can get the data 

  
  // set max
  let svg_tags = document.getElementsByTagName("svg");
  console.log(svg_tags);  
  let svg_max_width = 0; 
  for(let t of svg_tags){
    svg_max_width = Math.max(svg_max_width, t.width); 
  }
  console.log(svg_max_width); 
  document.getElementById("overall").setAttribute("max-width", svg_max_width * 1.1); 
}

// from wikipedia example with some hard coding: 
class SPARQLQueryDispatcher {
	constructor() {
		this.endpoint = 'https://query.wikidata.org/sparql';
	}

	query( sparqlQuery ) {
		const fullUrl = this.endpoint + '?query=' + encodeURIComponent( sparqlQuery );
		const headers = { 'Accept': 'application/sparql-results+json' };

		return fetch( fullUrl, { headers } ).then( body => body.json() );
	}
}
// done

async function queryWikiDataAuthor(query){
  var sparqlQuery = `SELECT DISTINCT ?item ?itemLabel ?gender
    WHERE {
      ?item wdt:P31 wd:Q5;
            wdt:P21 ?gender;
            (rdfs:label|skos:altLabel) "${query}"@en.                      # Any instance of a human
    }`;
    const queryDispatcher = new SPARQLQueryDispatcher(); 

    return (await queryDispatcher.query(sparqlQuery))["results"]["bindings"][0]; 
}

async function queryWikiDataLabel(query){
  var sparqlQuery = `SELECT DISTINCT ?item ?itemLabel
    WHERE {
        VALUES ?item { ${query} } # Any instance of a human
      
        SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],mul,en" }
    }`;
    const queryDispatcher = new SPARQLQueryDispatcher(); 

    return (await queryDispatcher.query(sparqlQuery))["results"]["bindings"][0]["itemLabel"]["value"]; 
}

async function getAuthorWikidata(data){
  console.log(data); 
  console.log("Getting author data"); 
  var authors = {};
  let progress = document.getElementById("wikidataProgress");
  let misses = []; 

  for(let i = 0; i < data.length; i++){
    let target_author = data[i]["Author"].split(/[ ]+/).join(" "); 
    progress.innerText = `Getting Author Information from WikiData (this can take a bit as the WikiData API used is rate-limited and can be throttled): ${i+1}/${data.length} (${target_author})`;
    if(authors[target_author]) {
      continue; 
    }

    console.log("looking for", target_author); 
    const res = await queryWikiDataAuthor(target_author); 
    console.log(res); 

    if(res){
      authors[target_author] = {
        "name": await queryWikiDataLabel("wd:"+res["item"]["value"].split("/")[4]),
        "gender": await queryWikiDataLabel("wd:"+res["gender"]["value"].split("/")[4])
      }; 
    } else {
      let retry_target = target_author.split(/\.[ ]*/).join(". "); 
      var res2 = null; 
      if(retry_target != target_author){
        console.log("second try looking for", retry_target); 
        res2 = await queryWikiDataAuthor(retry_target); 
        console.log(res2); 
      }

      if(res2){
        authors[target_author] = {
          "name": await queryWikiDataLabel("wd:"+res2["item"]["value"].split("/")[4]),
          "gender": await queryWikiDataLabel("wd:"+res2["gender"]["value"].split("/")[4])
        }; 
      } else {
        let final_target = ""; 
        let final_split = retry_target.split(/\.[ ]*/);
        final_target += final_split[0]; 
        for(let i = 1; i < final_split.length; i++){
          if(final_split[i-1].length == 1 && final_split[i].length == 1){
            final_target += final_split[i]; 
          } else {
            final_target += " " + final_split[i]; 
          }
        }
        var res3 = null; 
        if(final_target != target_author){
          console.log("second try looking for", final_target); 
          res3 = await queryWikiDataAuthor(final_target); 
          console.log(res3); 
        }

        if(res3){
          authors[target_author] = {
            "name": await queryWikiDataLabel("wd:"+res3["item"]["value"].split("/")[4]),
            "gender": await queryWikiDataLabel("wd:"+res3["gender"]["value"].split("/")[4])
          }; 
        }
        else {
          misses.push(target_author); 
        }
      }
    }
  }

  progress.innerHTML = `Done getting author information, found ${data.length-misses.length} out of ${data.length} authors! <br />
  Author data is queried from <a href="www.wikidata.org" target="_blank">Wikidata</a> by name so if a name or alias mismatches between Goodreads and Wikidata there can be a miss even if the author does exist on Wikidata.
  If the author doesn't exist on Wikidata and you think they should, <a href="https://www.wikidata.org/wiki/Wikidata:Contribute" target="_blank">add them!</a> Wikidata and other Wikimedia projects are supported by user edits. 
  <br />
  Misses: ${misses.join(", ")}.
  `;



  console.log("Misses:", misses); 

  return authors; 
}

function genBooksByGenderPieChart(data, wikidata){
  console.log("gender pie"); 

  // count 
  var genders = {}; 
  for(const author in wikidata){
    // console.log(wikidata[author]); 
    if(genders[wikidata[author]["gender"]]){
      genders[wikidata[author]["gender"]]++; 
    } else {
      genders[wikidata[author]["gender"]] = 1; 
    }
  }

  const margin = { top: 100, right: 300, bottom: 100, left: 200 },
    width = 900 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

  const radius = Math.min(width, height) / 2;
  console.log(radius); 

  var svg = d3.select("#BooksByGender")
    .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
    .append("g")
      .attr("transform", `translate(${margin.left + width / 2},${margin.top + height / 2})`);

  var color = d3.scaleOrdinal()
    .range(d3.schemeSet2); 
  
  const pie = d3.pie()
    .value(function(d) {
      return d[1]; 
    });

  console.log(Object.entries(genders)); 
  const data_ready = pie(Object.entries(genders)); 
  console.log(data_ready); 

  // shape helper
  const arcGenerator = d3.arc()
    .innerRadius(0)
    .outerRadius(radius); 

  var slices = svg.selectAll("mySlices")
    .data(data_ready)
    .join("path")
      .attr("d", arcGenerator)
      .attr("fill", function(d) { 
        return(color(d.data[0]));
      })
      .attr("stroke", "black")
      .style("stroke-width", "2px")
      .style("opacity", 0.7);

  slices.on('mouseover', function (event, d) {
    d3.select(this)
        .transition()
        .duration(200)
        .attr('transform', 'scale(1.1)');
    svg.append("text")
      .attr("id", "pie_temp")
      .text(`${d.data[0]} (${(d.data[1] / Object.keys(wikidata).length * 100).toFixed(2)}%)`)
      .attr("transform", function() { 
        let factor = 2.3; 
        return `translate(${arcGenerator.centroid(d)[0]*factor}, ${arcGenerator.centroid(d)[1]*factor})`;
      })
      .style("text-anchor", function() {
        let pos = arcGenerator.centroid(d)[0];
        if(pos < 0){
          return "end"; 
        } else {
          return "start"; 
        }
      })
      .style("font-size", 17)
      
    // console.log(d); 
  })
  .on('mouseout', function (event, d) {
      d3.select(this)
          .transition()
          .duration(200)
          .attr('transform', 'scale(1)');

      d3.selectAll("#pie_temp").remove(); 
  });

  let sorted_for_legend = [...data_ready].sort((a, b) => d3.descending(a.value, b.value))

  svg.selectAll('myLegend')     
    .data(sorted_for_legend)     
    .enter()     
    .append('text')     
    .attr('x', 4.5 * width / 7)     
    .attr('y', (d, i) => {
      return -height / 2 + i * 20; 
    })
    .text(d => {
      return `${d.data[0]}: ${d.data[1]} (${(d.data[1]/Object.keys(wikidata).length).toFixed(2)}%)`;
    });

  svg.selectAll('myLegendBoxes')
    .data(sorted_for_legend)
    .enter()
    .append("rect")
    .attr("x", 4.5 * width / 7 - 25)
    .attr('y', (d, i) => {
      return -height / 2 + i * 20 - 10; 
    })
    .attr('width', 15)
    .attr('height', 15)
    .attr("fill", function(d) {
      return color(d.data[0]);
    });

  svg.append("text")
    .text("Authors By Gender")
    .attr("x", 0)
    .attr("y", -(height + margin.top) / 2 )
    .attr("text-anchor", "middle")
    .attr("font-size", 30); 

  setupSaveSVG("BooksByGender"); 
}

function genBooksByYearBarGraph(data){
  console.log("By year bar chart"); 

  // Define dimensions and margins for the chart area
  const margin = { top: 40, right: 30, bottom: 50, left: 80 },
    width = 800 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;

  var svg = d3.select("#BooksByYear")
    .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
    .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

  // prep data 
  let by_year = {};
  data.forEach(element => {
    if(element["Date Read"] != "" || element["Data Read"] == NaN){
      let year = new Date(element["Date Read"]).getFullYear();
      if(year == NaN) return false; 
      by_year[year] = (by_year[year])? by_year[year] + 1 : 1; 
    }
  });
  console.log("by_year:", by_year); 

  var x = d3.scaleBand()
    .range([0,width])
    .domain(Object.keys(by_year))
    .padding(0.2); 

  svg.append("g")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(x))
    .selectAll("text")
      // .attr("transform", "translate(-10,0)rotate(-45)")
      .style("text-anchor", "middle")
      .attr("font-size", 15);

  console.log("at y", Math.max(...Object.values(by_year))); 
  var y = d3.scaleLinear()
    .domain([0, Math.max(...Object.values(by_year))])
    .range([height, 0]); 

  svg.append("g")
    .call(d3.axisLeft(y)); 


  svg.selectAll("mybar")
    .data(Object.entries(by_year))
    .enter()
    .append('rect')
      .attr("x", function(d) { return x(d[0]) })
      .attr("y", function(d) { return y(d[1]) })
      .attr("width", x.bandwidth())
      .attr("height", function(d) { 
        return height - y(d[1]);
      })
      .attr("fill", "#69b3a2")

  svg.selectAll("mybar")
    .data(Object.entries(by_year))
    .enter()
    .append('text')
      .text(function(d) { return d[1] })
      .attr("x", function(d) { return x(d[0]) + x.bandwidth() / 2 })
      .attr("y", function(d) { 
        if(y(d[1]) + x.bandwidth() / 2 < height - margin.bottom ) return y(d[1]) + x.bandwidth() / 2; 
        else return y(d[1]) - x.bandwidth() / 8; 
      })
      .attr("text-anchor", "middle")
      .attr("fill", "black")
      .attr("font-size", x.bandwidth() / 2); 

  svg.append("text")
    .text("Books Read Each Year")
    .attr("text-anchor", "end")
    .attr("font-size", 30)
    .attr("x", width - margin.right)
    .attr("y", y(Math.max(...Object.values(by_year))) * 1.1);  

  svg.append("text")
    .text("Number of Books")
    .attr("text-anchor", "middle")
    .attr("font-size", 20)
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -margin.left / 2);

  svg.append("text")
    .text("Year")
    .attr("text-anchor", "middle")
    .attr("font-size", 20)
    .attr("x", width / 2)
    .attr("y", height + 4 * margin.bottom / 5)

  setupSaveSVG("BooksByYear")
}

function genLifeStats(data){
  let activeStat = data[0]["Date Added"]; 
  let bookCount = 0; 
  let pageCount = 0; 
  let fiveStarCount = 0; 
  let earliestBook = null; 
  let ratingTotal = 0; 
  data.forEach(function(row){
    // console.log(row); 
    if(activeStat > row["Date Added"]) activeStat = row["Date Added"];
    if((!(!row["Date Read"] || !row["Date Read"].trim()) && (earliestBook == null || earliestBook > row["Date Read"]))){
      // console.log("new:", row["Date Read"]); 
      earliestBook = row["Date Read"];
    }

    if(row["Exclusive Shelf"] == "read"){
      bookCount++;
      pageCount += Number(row["Number of Pages"]); 
      if(row["My Rating"] == "5") fiveStarCount++; 
      ratingTotal += Number(row["My Rating"]); 
    }
  });
  

  document.getElementById("activeStat").innerText = activeStat; 
  document.getElementById("earliestStat").innerText = earliestBook; 
  document.getElementById("readStat").innerText = bookCount; 
  document.getElementById("pagesStat").innerText = pageCount; 
  document.getElementById("fiveStarStat").innerText = fiveStarCount; 
  document.getElementById("ratingStat").innerText = (ratingTotal / bookCount).toFixed(2); 

  let today = new Date(); 
  let start = new Date(earliestBook); 
  let days = Math.abs(today - start) / (1000 * 60 * 60 * 24); 


  document.getElementById("AbpyStat").innerText = (bookCount / days * 365).toFixed(2); 
  document.getElementById("AppyStat").innerText = (pageCount / days * 365).toFixed(2); 
}

function setupSaveSVG(target, name = target){
  var svg = document.getElementById(target); 
  console.log("svg:", svg); 

  var serializer = new XMLSerializer(); 
  var source = serializer.serializeToString(svg); 

  //add name spaces.
  if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if(!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)){
      source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  }

  source = '<?xml version="1.0" standalone="no"?>\r\n' + source;

  const blob = new Blob([source], { type: 'text/plain'}); 
  const url = URL.createObjectURL(blob); 

  let newA = document.createElement('a'); 
  newA.text = "Download Graphic"; 
  newA.href = url; 
  newA.download = `${name}.svg`; 

  document.getElementById(target).append(document.createElement('br')); 
  document.getElementById(target).append(newA); 

}