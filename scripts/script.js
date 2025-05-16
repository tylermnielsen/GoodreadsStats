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

function processData(csv_string){
  const data = d3.csvParse(csv_string, function(d, i) {
    return d; 
  });

  console.log(data);

  // general life stats
  genLifeStats(data); 

  genBooksByYearBarGraph(data); 


  // wikidata
  // gender break down 

  // Country breakdown
  // citizenship
  
  // birth 

  // sexual orientation - if I can get the data 

  // 
}

function genLifeStats(data){
  let activeStat = data[0]["Date Added"]; 
  let bookCount = 0; 
  let pageCount = 0; 
  let fiveStarCount = 0; 
  let earliestBook = null; 
  let ratingTotal = 0; 
  data.forEach(function(row){
    console.log(row); 
    if(activeStat > row["Date Added"]) activeStat = row["Date Added"];
    if((!(!row["Date Read"] || !row["Date Read"].trim()) && (earliestBook == null || earliestBook > row["Date Read"]))){
      console.log("new:", row["Date Read"]); 
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
      .attr("transform", "translate(-10,0)rotate(-45)")
      .style("text-anchor", "end"); 

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

  setupSaveSVG("BooksByYear")
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