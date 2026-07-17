const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ysnzcfrhabkedhqacmrk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzbnpjZnJoYWJrZWRocWFjbXJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNjIxMTAsImV4cCI6MjA5OTgzODExMH0.wZr4wdIgfUEgr1AMXvXFsTfDZQKv_WGGbqp6m9zdvhI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function clean() {
  const { data, error } = await supabase.from('transactions').select('id');
  if (error) {
    console.error("Error fetching:", error);
    return;
  }
  console.log(`Found ${data.length} transactions. Deleting...`);
  
  for (let row of data) {
    const { error: delError } = await supabase.from('transactions').delete().eq('id', row.id);
    if (delError) console.error("Error deleting", row.id, delError);
  }
  console.log("Finished deleting.");
}

clean();
